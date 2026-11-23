from pathlib import Path

import cv2

from app.core.config import YUNET_MODEL
from app.vision.detector import FaceDetector


def main():
    if not Path(YUNET_MODEL).exists():
        raise FileNotFoundError(
            f"YuNet model not found: {YUNET_MODEL}"
        )

    detector = FaceDetector(YUNET_MODEL)

    camera = cv2.VideoCapture(0)

    if not camera.isOpened():
        raise RuntimeError(
            "Could not open webcam."
        )

    print("Camera started.")
    print("Press Q to exit.")

    while True:
        success, frame = camera.read()

        if not success:
            print("Failed to read frame.")
            break

        faces = detector.detect(frame)

        for face in faces:
            x, y, w, h = face[:4].astype(int)

            confidence = float(face[-1])

            cv2.rectangle(
                frame,
                (x, y),
                (x + w, y + h),
                (0, 255, 0),
                2,
            )

            cv2.putText(
                frame,
                f"Face {confidence:.2f}",
                (x, max(y - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2,
            )

        cv2.imshow(
            "Smart Campus Vision",
            frame,
        )

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()