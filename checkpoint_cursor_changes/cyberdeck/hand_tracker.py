"""Hand tracking backend — supports MediaPipe Tasks API (0.10+) and legacy solutions."""

from __future__ import annotations

import os
import sys
import time
from dataclasses import dataclass
from typing import List, Optional, Protocol

import numpy as np

MEDIAPIPE_AVAILABLE = False
_TRACKER_BACKEND = "none"


class _Landmark(Protocol):
    x: float
    y: float
    z: float


@dataclass
class HandLandmarks:
    landmark: List[_Landmark]


_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)


def _model_path() -> str:
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    bundled = os.path.join(base, "assets", "hand_landmarker.task")
    if os.path.isfile(bundled):
        return bundled
    if getattr(sys, "frozen", False):
        frozen = os.path.join(sys._MEIPASS, "assets", "hand_landmarker.task")
        if os.path.isfile(frozen):
            return frozen
    return bundled


def _ensure_model(path: str) -> None:
    if os.path.isfile(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    print(f"[cyberdeck] Downloading hand tracking model...")
    try:
        import urllib.request
        urllib.request.urlretrieve(_MODEL_URL, path)
        print(f"[cyberdeck] Model saved to {path}")
    except Exception as exc:
        raise FileNotFoundError(
            f"Hand model not found at {path} and download failed: {exc}"
        ) from exc


class HandTracker:
    """Unified hand detector interface."""

    def __init__(
        self,
        max_hands: int = 1,
        min_detection: float = 0.7,
        min_tracking: float = 0.7,
    ):
        self._backend = _TRACKER_BACKEND
        self._legacy = None
        self._tasks = None
        self._frame_ts = 0

        if self._backend == "tasks":
            import mediapipe as mp
            from mediapipe.tasks import python as mp_tasks
            from mediapipe.tasks.python import vision
            from mediapipe.tasks.python.vision.core.vision_task_running_mode import (
                VisionTaskRunningMode,
            )

            model = _model_path()
            _ensure_model(model)

            options = vision.HandLandmarkerOptions(
                base_options=mp_tasks.BaseOptions(model_asset_path=model),
                running_mode=VisionTaskRunningMode.VIDEO,
                num_hands=max_hands,
                min_hand_detection_confidence=min_detection,
                min_hand_presence_confidence=min_detection,
                min_tracking_confidence=min_tracking,
            )
            self._tasks = vision.HandLandmarker.create_from_options(options)
            self._mp_image_cls = mp.Image
            self._mp_format = mp.ImageFormat.SRGB
        elif self._backend == "legacy":
            import mediapipe as mp

            self._legacy = mp.solutions.hands.Hands(
                max_num_hands=max_hands,
                model_complexity=0,
                min_detection_confidence=min_detection,
                min_tracking_confidence=min_tracking,
            )

    def process(self, rgb_frame: np.ndarray) -> Optional[HandLandmarks]:
        if self._backend == "tasks":
            self._frame_ts += 33
            mp_image = self._mp_image_cls(
                image_format=self._mp_format, data=np.ascontiguousarray(rgb_frame),
            )
            result = self._tasks.detect_for_video(mp_image, self._frame_ts)
            if not result.hand_landmarks:
                return None
            return HandLandmarks(landmark=list(result.hand_landmarks[0]))

        if self._backend == "legacy":
            results = self._legacy.process(rgb_frame)
            if not results.multi_hand_landmarks:
                return None
            return HandLandmarks(landmark=list(results.multi_hand_landmarks[0].landmark))

        return None

    def close(self) -> None:
        if self._legacy:
            self._legacy.close()
        if self._tasks:
            self._tasks.close()


def _detect_backend() -> str:
    try:
        import mediapipe as mp
        if hasattr(mp, "solutions") and hasattr(mp.solutions, "hands"):
            return "legacy"
        from mediapipe.tasks.python import vision  # noqa: F401
        return "tasks"
    except Exception:
        return "none"


_TRACKER_BACKEND = _detect_backend()
MEDIAPIPE_AVAILABLE = _TRACKER_BACKEND != "none"
