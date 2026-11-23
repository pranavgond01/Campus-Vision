import sys
from pathlib import Path

import cv2

from app.core.config import (
    CAMERA_HEIGHT,
    CAMERA_INDEX,
    CAMERA_WIDTH,
    FACES_DIR,
    SFACE_MODEL,
    YUNET_MODEL,
)

from app.database.database import (
    Base,
    SessionLocal,
    engine,
)

from app.database.models import Person

from app.vision.detector import FaceDetector
from app.vision.enrollment import (
    embedding_to_json,
)
from app.vision.recognizer import FaceRecognizer


def initialize_database():

    Base.metadata.create_all(
        bind=engine
    )


def get_input(
    label: str,
    required: bool = True,
):

    while True:

        value = input(
            f"{label}: "
        ).strip()

        if value or not required:
            return value

        print(
            "This field is required."
        )


def capture_face():

    detector = FaceDetector(
        YUNET_MODEL
    )

    recognizer = FaceRecognizer(
        SFACE_MODEL
    )

    camera = cv2.VideoCapture(
        CAMERA_INDEX
    )

    camera.set(
        cv2.CAP_PROP_FRAME_WIDTH,
        CAMERA_WIDTH,
    )

    camera.set(
        cv2.CAP_PROP_FRAME_HEIGHT,
        CAMERA_HEIGHT,
    )

    if not camera.isOpened():

        raise RuntimeError(
            "Could not open webcam."
        )

    print()
    print(
        "Camera started."
    )
    print(
        "Look directly at the camera."
    )
    print(
        "Press SPACE to capture."
    )
    print(
        "Press Q to cancel."
    )

    captured_embedding = None

    while True:

        success, frame = (
            camera.read()
        )

        if not success:

            print(
                "Failed to read camera."
            )

            break

        faces = detector.detect(
            frame
        )

        display = frame.copy()

        if len(faces) == 0:

            cv2.putText(
                display,
                "No face detected",
                (30, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2,
            )

        elif len(faces) > 1:

            cv2.putText(
                display,
                "Only one person allowed",
                (30, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2,
            )

        else:

            face = faces[0]

            x, y, w, h = (
                face[:4].astype(int)
            )

            cv2.rectangle(
                display,
                (x, y),
                (x + w, y + h),
                (0, 255, 0),
                2,
            )

            cv2.putText(
                display,
                "Ready - press SPACE",
                (30, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 0),
                2,
            )

        cv2.imshow(
            "Face Enrollment",
            display,
        )

        key = (
            cv2.waitKey(1)
            & 0xFF
        )

        if key == ord("q"):

            break

        if (
            key == 32
            and len(faces) == 1
        ):

            face = faces[0]

            captured_embedding = (
                recognizer.extract_embedding(
                    frame,
                    face,
                )
            )

            print(
                "Face captured successfully."
            )

            break

    camera.release()

    cv2.destroyAllWindows()

    return captured_embedding


def register_person():

    initialize_database()

    print()
    print("=" * 60)
    print(
        "SMART CAMPUS VISION"
    )
    print(
        "TEST PERSON REGISTRATION"
    )
    print("=" * 60)
    print()

    print(
        "Use TEST/DUMMY information here."
    )

    print(
        "Do not enter real student data "
        "without appropriate authorization."
    )

    print()

    full_name = get_input(
        "Full name"
    )

    role = get_input(
        "Role (student/teacher)"
    ).lower()

    if role not in (
        "student",
        "teacher",
    ):

        print(
            "Role must be student or teacher."
        )

        return

    enrollment_no = get_input(
        "Enrollment number",
        required=False,
    )

    year = get_input(
        "Year",
        required=False,
    )

    branch = get_input(
        "Branch",
        required=False,
    )

    contact_number = get_input(
        "Contact number",
        required=False,
    )

    print()

    consent = input(
        "Does this TEST person consent "
        "to face enrollment? (yes/no): "
    ).strip().lower()

    if consent != "yes":

        print(
            "Enrollment cancelled."
        )

        return

    db = SessionLocal()

    try:

        if enrollment_no:

            existing = (
                db.query(Person)
                .filter(
                    Person.enrollment_no
                    == enrollment_no
                )
                .first()
            )

            if existing:

                print(
                    "Enrollment number already exists."
                )

                return

        print()

        embedding = capture_face()

        if embedding is None:

            print(
                "No face was enrolled."
            )

            return

        embedding_json = (
            embedding_to_json(
                embedding
            )
        )

        person = Person(
            full_name=full_name,
            role=role,
            enrollment_no=(
                enrollment_no
                or None
            ),
            year=year or None,
            branch=branch or None,
            contact_number=(
                contact_number
                or None
            ),
            face_embedding=(
                embedding_json
            ),
            consent_status=True,
        )

        db.add(person)

        db.commit()

        db.refresh(person)

        print()
        print("=" * 60)
        print(
            "PERSON REGISTERED"
        )
        print("=" * 60)

        print(
            f"ID:           {person.id}"
        )

        print(
            f"Name:         {person.full_name}"
        )

        print(
            f"Role:         {person.role}"
        )

        print(
            f"Enrollment:   {person.enrollment_no}"
        )

        print(
            f"Year:         {person.year}"
        )

        print(
            f"Branch:       {person.branch}"
        )

        print(
            "Face:         REGISTERED"
        )

        print(
            "Consent:      YES"
        )

        print("=" * 60)

    finally:

        db.close()


if __name__ == "__main__":

    try:

        register_person()

    except KeyboardInterrupt:

        print()
        print(
            "Registration cancelled."
        )

        sys.exit(0)

    except Exception as error:

        print()
        print(
            "ERROR:"
        )

        print(error)

        sys.exit(1)