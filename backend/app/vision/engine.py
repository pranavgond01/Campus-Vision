from dataclasses import dataclass

from app.core.config import (
    FACE_MATCH_THRESHOLD,
    SFACE_MODEL,
    YUNET_MODEL,
)

from app.database.models import Person

from .detector import FaceDetector
from .enrollment import embedding_from_json
from .recognizer import FaceRecognizer


@dataclass
class RecognitionResult:

    person: Person | None

    confidence: float

    face: object

    status: str


class RecognitionEngine:

    def __init__(self):

        self.detector = FaceDetector(
            YUNET_MODEL
        )

        self.recognizer = FaceRecognizer(
            SFACE_MODEL
        )

    def detect_faces(
        self,
        frame,
    ):

        return self.detector.detect(
            frame
        )

    def create_embedding(
        self,
        frame,
        face,
    ):

        return self.recognizer.extract_embedding(
            frame,
            face,
        )

    def recognize(
        self,
        frame,
        people,
    ):

        faces = self.detect_faces(
            frame
        )

        results = []

        for face in faces:

            embedding = (
                self.create_embedding(
                    frame,
                    face,
                )
            )

            best_person = None
            best_score = -1.0

            for person in people:

                if not person.consent_status:
                    continue

                if not person.face_embedding:
                    continue

                stored_embedding = (
                    embedding_from_json(
                        person.face_embedding
                    )
                )

                score = (
                    self.recognizer.compare(
                        embedding,
                        stored_embedding,
                    )
                )

                if score > best_score:

                    best_score = score
                    best_person = person

            if (
                best_person is not None
                and best_score >= FACE_MATCH_THRESHOLD
            ):

                result = RecognitionResult(
                    person=best_person,
                    confidence=best_score,
                    face=face,
                    status="MATCHED",
                )

            else:

                result = RecognitionResult(
                    person=None,
                    confidence=max(
                        best_score,
                        0.0,
                    ),
                    face=face,
                    status="UNKNOWN",
                )

            results.append(result)

        return results