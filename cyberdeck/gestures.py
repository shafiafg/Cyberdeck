"""Unified hand gesture detection — fist, pinch, swipe, palm tracking."""

from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]


@dataclass
class HandState:
    detected: bool = False
    palm_x: float = 0.5
    palm_y: float = 0.5
    smooth_x: float = 0.5
    smooth_y: float = 0.5
    fist: bool = False
    pinch: bool = False
    point: bool = False
    swipe: Optional[str] = None
    swipe_timer: float = 0.0
    landmarks: Optional[List[Dict[str, float]]] = None
    events: List[str] = field(default_factory=list)


class GestureEngine:
    FIST_THRESHOLD = 0.18
    PINCH_THRESHOLD = 0.05
    SWIPE_VELOCITY = 1.8
    SWIPE_COOLDOWN = 0.35

    def __init__(self, smoothing: float = 0.42, mirror: bool = True):
        self.smoothing = smoothing
        self.mirror = mirror
        self._prev_wrist_x: Optional[float] = None
        self._prev_time = time.perf_counter()
        self._swipe_cooldown_until = 0.0
        self._was_fist = False
        self._was_pinch = False
        self._was_point = False
        self._was_detected = False

    def set_smoothing(self, value: float) -> None:
        self.smoothing = max(0.05, min(1.0, value))

    @staticmethod
    def _dist(p1, p2) -> float:
        return math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2)

    def _serialize_landmarks(self, landmarks) -> List[Dict[str, float]]:
        return [
            {
                "x": round(lm.x, 4),
                "y": round(lm.y, 4),
                "z": round(lm.z, 4),
            }
            for lm in landmarks.landmark
        ]

    def process(self, landmarks) -> HandState:
        now = time.perf_counter()
        dt = max(0.001, now - self._prev_time)
        self._prev_time = now

        state = HandState(detected=True)
        state.landmarks = self._serialize_landmarks(landmarks)

        wrist = landmarks.landmark[0]
        thumb = landmarks.landmark[4]
        index = landmarks.landmark[8]
        middle = landmarks.landmark[12]
        ring = landmarks.landmark[16]
        pinky = landmarks.landmark[20]
        palm = landmarks.landmark[9]

        scale = self._dist(wrist, palm) or 0.1
        finger_ratios = [
            self._dist(index, wrist) / scale,
            self._dist(middle, wrist) / scale,
            self._dist(ring, wrist) / scale,
            self._dist(pinky, wrist) / scale,
        ]
        avg_finger = sum(finger_ratios) / len(finger_ratios)

        px = palm.x
        py = palm.y
        state.palm_x = max(0.0, min(1.0, px))
        state.palm_y = max(0.0, min(1.0, py))

        if avg_finger < self.FIST_THRESHOLD:
            state.fist = True
            if not self._was_fist:
                state.events.append("FIST_START")
            else:
                state.events.append("FIST_MOVE")
        else:
            # Pointing gesture: index extended, others curled
            is_point = (
                finger_ratios[0] > 1.6 and
                finger_ratios[1] < 1.3 and
                finger_ratios[2] < 1.3 and
                finger_ratios[3] < 1.3
            )
            if is_point:
                state.point = True
                if not self._was_point:
                    state.events.append("POINT_START")
                else:
                    state.events.append("POINT_MOVE")
            else:
                pinch_dist = self._dist(index, thumb)
                if pinch_dist < self.PINCH_THRESHOLD:
                    state.pinch = True
                    cx = (index.x + thumb.x) / 2.0
                    cy = (index.y + thumb.y) / 2.0
                    state.palm_x = max(0.0, min(1.0, cx))
                    state.palm_y = max(0.0, min(1.0, cy))
                    if not self._was_pinch:
                        state.events.append("PINCH_START")
                    else:
                        state.events.append("PINCH_MOVE")
                else:
                    state.events.append("PALM_MOVE")

        wrist_x = wrist.x
        if self._prev_wrist_x is not None and now >= self._swipe_cooldown_until:
            velocity = (wrist_x - self._prev_wrist_x) / dt
            if abs(velocity) > self.SWIPE_VELOCITY:
                direction = "SWIPE_RIGHT" if velocity > 0 else "SWIPE_LEFT"
                state.swipe = direction
                state.swipe_timer = 0.6
                state.events.append(direction)
                self._swipe_cooldown_until = now + self.SWIPE_COOLDOWN
        self._prev_wrist_x = wrist_x

        if not self._was_detected:
            state.events.append("HAND_DETECTED")

        self._was_fist = state.fist
        self._was_pinch = state.pinch
        self._was_point = state.point
        self._was_detected = True
        return state

    def no_hand(self) -> HandState:
        state = HandState(detected=False, palm_x=0.5, palm_y=0.5)
        if self._was_detected:
            state.events.append("HAND_LOST")
        self._was_fist = False
        self._was_pinch = False
        self._was_point = False
        self._was_detected = False
        self._prev_wrist_x = None
        return state

    def apply_smoothing(self, state: HandState, current: HandState) -> HandState:
        s = self.smoothing
        if state.detected:
            current.smooth_x += (state.palm_x - current.smooth_x) * s
            current.smooth_y += (state.palm_y - current.smooth_y) * s
        else:
            current.smooth_x += (0.5 - current.smooth_x) * s * 0.5
            current.smooth_y += (0.5 - current.smooth_y) * s * 0.5
        current.detected = state.detected
        current.palm_x = state.palm_x
        current.palm_y = state.palm_y
        current.fist = state.fist
        current.pinch = state.pinch
        current.point = state.point
        current.landmarks = state.landmarks
        if state.swipe:
            current.swipe = state.swipe
            current.swipe_timer = state.swipe_timer
        current.events = list(state.events)
        return current
