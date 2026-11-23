from pathlib import Path

import cv2


class FaceRecognizer:

    def __init__(
        self,
        model_path: str | Path,
    ):
        model_path = Path(model_path)

        if not model_path.exists():
            raise FileNotFoundError(
                f"SFace model not found:\n{model_path}"
            )

        self.recognizer = (
            cv2.FaceRecognizerSF.create(
                str(model_path),
                "",
            )
        )

    def extract_embedding(
        self,
        frame,
        face,
    ):

        aligned_face = (
            self.recognizer.alignCrop(
                frame,
                face,
            )
        )

        feature = (
            self.recognizer.feature(
                aligned_face
            )
        )

        return feature

    def compare(
        self,
        embedding_1,
        embedding_2,
    ):

        score = (
            self.recognizer.match(
                embedding_1,
                embedding_2,
                cv2.FaceRecognizerSF_FR_COSINE,
            )
        )

        return float(score)