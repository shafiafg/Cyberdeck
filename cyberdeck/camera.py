"""Threaded webcam + MediaPipe pipeline for low-latency gesture tracking."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np

from cyberdeck.gestures import GestureEngine, HandState
from cyberdeck.hand_tracker import HandTracker, MEDIAPIPE_AVAILABLE

OPENCV_AVAILABLE = False

try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    pass


@dataclass
class CameraConfig:
    device_id: int = 0
    width: int = 640
    height: int = 480
    mirror: bool = True
    target_fps: int = 60
    smoothing: float = 0.42


@dataclass
class TrackingSnapshot:
    frame: Optional[np.ndarray] = None
    hand: HandState = field(default_factory=HandState)
    fps_track: float = 0.0
    fps_capture: float = 0.0
    online: bool = False
    error: Optional[str] = None


class CameraPipeline:
    """Background thread captures frames and runs MediaPipe without blocking render."""

    def __init__(self, config: Optional[CameraConfig] = None):
        self.config = config or CameraConfig()
        self.engine = GestureEngine(smoothing=self.config.smoothing, mirror=self.config.mirror)
        self._lock = threading.Lock()
        self._snapshot = TrackingSnapshot()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._cap = None
        self._tracker = None
        self._log_buffer: List[str] = []
        self._smooth_state = HandState()

    @property
    def available(self) -> bool:
        return OPENCV_AVAILABLE and MEDIAPIPE_AVAILABLE

    def get_snapshot(self) -> TrackingSnapshot:
        with self._lock:
            snap = self._snapshot
            if snap.frame is not None:
                return TrackingSnapshot(
                    frame=snap.frame.copy(),
                    hand=HandState(
                        detected=snap.hand.detected,
                        palm_x=snap.hand.palm_x,
                        palm_y=snap.hand.palm_y,
                        smooth_x=snap.hand.smooth_x,
                        smooth_y=snap.hand.smooth_y,
                        fist=snap.hand.fist,
                        pinch=snap.hand.pinch,
                        point=snap.hand.point,
                        swipe=snap.hand.swipe,
                        swipe_timer=snap.hand.swipe_timer,
                        landmarks=snap.hand.landmarks,
                        events=list(snap.hand.events),
                    ),
                    fps_track=snap.fps_track,
                    fps_capture=snap.fps_capture,
                    online=snap.online,
                    error=snap.error,
                )
            return TrackingSnapshot(
                hand=HandState(
                    detected=snap.hand.detected,
                    palm_x=snap.hand.smooth_x,
                    palm_y=snap.hand.smooth_y,
                    smooth_x=snap.hand.smooth_x,
                    smooth_y=snap.hand.smooth_y,
                    fist=snap.hand.fist,
                    pinch=snap.hand.pinch,
                    point=snap.hand.point,
                    swipe=snap.hand.swipe,
                    swipe_timer=snap.hand.swipe_timer,
                    landmarks=snap.hand.landmarks,
                    events=list(snap.hand.events),
                ),
                fps_track=snap.fps_track,
                fps_capture=snap.fps_capture,
                online=snap.online,
                error=snap.error,
            )

    def pop_events(self) -> List[str]:
        with self._lock:
            events = list(self._snapshot.hand.events)
            self._snapshot.hand.events.clear()
            return events

    def set_smoothing(self, value: float) -> None:
        self.engine.set_smoothing(value)
        self.config.smoothing = value

    def start(self) -> Tuple[bool, str]:
        if not self.available:
            msg = "Missing opencv-python or mediapipe. Run: pip install -r requirements.txt"
            with self._lock:
                self._snapshot.error = msg
            return False, msg

        self._cap = cv2.VideoCapture(self.config.device_id, cv2.CAP_DSHOW if _is_windows() else cv2.CAP_V4L2)
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.width)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.height)
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not self._cap.isOpened():
            msg = "Webcam not found. Check camera connection and permissions."
            with self._lock:
                self._snapshot.error = msg
            return False, msg

        self._tracker = HandTracker(
            max_hands=1,
            min_detection=0.7,
            min_tracking=0.7,
        )

        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="cyberdeck-camera")
        self._thread.start()
        return True, "Camera online"

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)
            self._thread = None
        if self._tracker:
            self._tracker.close()
            self._tracker = None
        if self._cap:
            self._cap.release()
            self._cap = None

    def _loop(self) -> None:
        frame_interval = 1.0 / self.config.target_fps
        last_capture = time.perf_counter()
        capture_count = 0
        track_count = 0
        fps_capture = 0.0
        fps_track = 0.0
        fps_timer = time.perf_counter()

        while self._running:
            loop_start = time.perf_counter()
            ret, frame = self._cap.read()
            if not ret:
                time.sleep(0.01)
                continue

            if self.config.mirror:
                frame = cv2.flip(frame, 1)

            capture_count += 1
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False
            landmarks = self._tracker.process(rgb)

            if landmarks:
                raw = self.engine.process(landmarks)
            else:
                raw = self.engine.no_hand()

            self._smooth_state = self.engine.apply_smoothing(raw, self._smooth_state)
            if self._smooth_state.swipe_timer > 0:
                self._smooth_state.swipe_timer = max(0.0, self._smooth_state.swipe_timer - frame_interval)

            track_count += 1
            now = time.perf_counter()
            if now - fps_timer >= 1.0:
                elapsed = now - fps_timer
                fps_capture = capture_count / elapsed
                fps_track = track_count / elapsed
                capture_count = 0
                track_count = 0
                fps_timer = now

            with self._lock:
                self._snapshot.frame = frame
                self._snapshot.hand = self._smooth_state
                self._snapshot.fps_capture = fps_capture
                self._snapshot.fps_track = fps_track
                self._snapshot.online = True
                self._snapshot.error = None

            elapsed = time.perf_counter() - loop_start
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)


def _is_windows() -> bool:
    import sys
    return sys.platform.startswith("win")
