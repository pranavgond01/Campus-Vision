import threading
import time
from typing import Optional

import cv2


class CameraManager:

    def __init__(
        self,
        source=0,
        width: int = 1280,
        height: int = 720,
        fps: int = 30,
    ):

        self.source = source

        self.width = width

        self.height = height

        self.fps = fps

        self.capture: Optional[
            cv2.VideoCapture
        ] = None

        self.running = False

        self.thread: Optional[
            threading.Thread
        ] = None

        self.lock = threading.Lock()

        self.latest_frame = None

        self.last_error = None

    def start(self):

        if self.running:
            return

        self.capture = cv2.VideoCapture(
            self.source
        )

        if not self.capture.isOpened():

            self.capture.release()

            self.capture = None

            raise RuntimeError(
                f"Could not open camera source: "
                f"{self.source}"
            )

        self.capture.set(
            cv2.CAP_PROP_FRAME_WIDTH,
            self.width,
        )

        self.capture.set(
            cv2.CAP_PROP_FRAME_HEIGHT,
            self.height,
        )

        self.capture.set(
            cv2.CAP_PROP_FPS,
            self.fps,
        )

        self.running = True

        self.last_error = None

        self.thread = threading.Thread(
            target=self._capture_loop,
            daemon=True,
        )

        self.thread.start()

    def _capture_loop(self):

        while self.running:

            if self.capture is None:
                break

            success, frame = (
                self.capture.read()
            )

            if not success:

                self.last_error = (
                    "Camera frame read failed."
                )

                time.sleep(0.05)

                continue

            with self.lock:

                self.latest_frame = frame

    def get_frame(self):

        with self.lock:

            if self.latest_frame is None:
                return None

            return self.latest_frame.copy()

    def stop(self):

        self.running = False

        if self.thread is not None:

            self.thread.join(
                timeout=2
            )

            self.thread = None

        if self.capture is not None:

            self.capture.release()

            self.capture = None

        with self.lock:

            self.latest_frame = None

    def is_running(self):

        return self.running

    def get_status(self):

        return {
            "running": self.running,
            "source": str(self.source),
            "width": self.width,
            "height": self.height,
            "fps": self.fps,
            "last_error": self.last_error,
        }