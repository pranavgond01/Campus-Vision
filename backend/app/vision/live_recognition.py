import threading
import time
from datetime import datetime

import cv2

from app.core.config import (
    DEFAULT_CAMERA_ID,
)

from app.database.database import (
    SessionLocal,
)

from app.database.models import (
    Person,
    RecognitionEvent,
)

from .camera_manager import (
    CameraManager,
)

from .engine import (
    RecognitionEngine,
)


class LiveRecognitionService:

    def __init__(
        self,
        camera_manager: CameraManager,
        camera_id: str = DEFAULT_CAMERA_ID,
    ):

        self.camera_manager = (
            camera_manager
        )

        self.camera_id = camera_id

        self.engine = (
            RecognitionEngine()
        )

        self.running = False

        self.thread = None

        self.lock = threading.Lock()

        self.latest_processed_frame = None

        self.latest_results = []

        self.last_process_time = 0.0

        self.process_interval = 0.10

    def start(self):

        if self.running:
            return

        if not self.camera_manager.is_running():

            self.camera_manager.start()

        self.running = True

        self.thread = threading.Thread(
            target=self._recognition_loop,
            daemon=True,
        )

        self.thread.start()

    def _get_people(self):

        db = SessionLocal()

        try:

            people = (
                db.query(Person)
                .filter(
                    Person.consent_status
                    == True
                )
                .filter(
                    Person.face_embedding.isnot(None)
                )
                .all()
            )

            return people

        finally:

            db.close()

    def _recognition_loop(self):

        while self.running:

            now = time.time()

            if (
                now - self.last_process_time
                < self.process_interval
            ):

                time.sleep(0.01)

                continue

            frame = (
                self.camera_manager.get_frame()
            )

            if frame is None:

                time.sleep(0.05)

                continue

            self.last_process_time = now

            try:

                people = self._get_people()

                results = (
                    self.engine.recognize(
                        frame,
                        people,
                    )
                )

                processed = frame.copy()

                self._draw_results(
                    processed,
                    results,
                )

                with self.lock:

                    self.latest_processed_frame = (
                        processed
                    )

                    self.latest_results = results

            except Exception as error:

                print(
                    "[Recognition Error]",
                    error,
                )

                time.sleep(0.1)

    def _draw_results(
        self,
        frame,
        results,
    ):

        for result in results:

            face = result.face

            x, y, w, h = (
                face[:4].astype(int)
            )

            if result.status == "MATCHED":

                person = result.person

                color = (
                    0,
                    255,
                    0,
                )

                label = (
                    person.full_name
                )

                secondary = (
                    f"{person.role} | "
                    f"{person.enrollment_no or 'N/A'}"
                )

            else:

                color = (
                    0,
                    0,
                    255,
                )

                label = "UNKNOWN"

                secondary = (
                    f"Similarity: "
                    f"{result.confidence:.3f}"
                )

            cv2.rectangle(
                frame,
                (x, y),
                (
                    x + w,
                    y + h,
                ),
                color,
                2,
            )

            label_y = max(
                y - 45,
                30,
            )

            cv2.rectangle(
                frame,
                (
                    x,
                    label_y - 28,
                ),
                (
                    x + max(w, 300),
                    label_y + 35,
                ),
                color,
                -1,
            )

            cv2.putText(
                frame,
                label,
                (
                    x + 5,
                    label_y - 5,
                ),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (
                    255,
                    255,
                    255,
                ),
                2,
            )

            cv2.putText(
                frame,
                secondary,
                (
                    x + 5,
                    label_y + 18,
                ),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.42,
                (
                    255,
                    255,
                    255,
                ),
                1,
            )

        cv2.putText(
            frame,
            "SMART CAMPUS VISION",
            (
                20,
                35,
            ),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (
                255,
                255,
                255,
            ),
            2,
        )

        cv2.putText(
            frame,
            datetime.now().strftime(
                "%Y-%m-%d %H:%M:%S"
            ),
            (
                20,
                65,
            ),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (
                255,
                255,
                255,
            ),
            1,
        )

    def get_frame(self):

        with self.lock:

            if (
                self.latest_processed_frame
                is None
            ):

                return None

            return (
                self.latest_processed_frame
                .copy()
            )

    def get_results(self):

        with self.lock:

            return list(
                self.latest_results
            )

    def get_status(self):

        return {
            "running": self.running,
            "camera_id": self.camera_id,
            "camera": (
                self.camera_manager
                .get_status()
            ),
        }

    def stop(self):

        self.running = False

        if self.thread is not None:

            self.thread.join(
                timeout=2
            )

            self.thread = None

        self.camera_manager.stop()