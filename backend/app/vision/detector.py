from pathlib import Path

import cv2


class FaceDetector:

    def __init__(
        self,
        model_path: str | Path,
        input_size: tuple[int, int] = (320, 320),
        confidence: float = 0.7,
        nms_threshold: float = 0.3,
        top_k: int = 5000,
    ):
        model_path = Path(model_path)

        if not model_path.exists():
            raise FileNotFoundError(
                f"YuNet model not found:\n{model_path}"
            )

        self.detector = cv2.FaceDetectorYN.create(
            str(model_path),
            "",
            input_size,
            confidence,
            nms_threshold,
            top_k,
        )

    def set_input_size(
        self,
        width: int,
        height: int,
    ) -> None:

        self.detector.setInputSize(
            (width, height)
        )

    def detect(self, frame):

        height, width = frame.shape[:2]

        self.set_input_size(
            width,
            height,
        )

        _, faces = self.detector.detect(
            frame
        )

        if faces is None:
            return []

        return faces