import cv2

from app.core.config import (
    CAMERA_HEIGHT,
    CAMERA_INDEX,
    CAMERA_WIDTH,
)

from app.database.database import (
    Base,
    SessionLocal,
    engine,
)

from app.database.models import Person

from app.vision.engine import (
    RecognitionEngine,
)


def initialize_database():

    Base.metadata.create_all(
        bind=engine
    )


def draw_result(
    frame,
    result,
):

    face = result.face

    x, y, w, h = (
        face[:4].astype(int)
    )

    if result.status == "MATCHED":

        person = result.person

        label = (
            f"{person.full_name} "
            f"| {person.role}"
        )

        details = (
            f"{person.enrollment_no or 'N/A'} "
            f"| {person.branch or 'N/A'}"
        )

        color = (
            0,
            255,
            0,
        )

    else:

        label = "UNKNOWN PERSON"

        details = (
            f"Similarity: "
            f"{result.confidence:.3f}"
        )

        color = (
            0,
            0,
            255,
        )

    cv2.rectangle(
        frame,
        (x, y),
        (x + w, y + h),
        color,
        2,
    )

    text_y = max(
        y - 35,
        25,
    )

    cv2.rectangle(
        frame,
        (
            x,
            text_y - 25,
        ),
        (
            x + max(w, 280),
            text_y + 45,
        ),
        color,
        -1,
    )

    cv2.putText(
        frame,
        label,
        (
            x + 5,
            text_y,
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
        details,
        (
            x + 5,
            text_y + 25,
        ),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.45,
        (
            255,
            255,
            255,
        ),
        1,
    )


def main():

    initialize_database()

    db = SessionLocal()

    try:

        people = (
            db.query(Person)
            .filter(
                Person.consent_status
                == True
            )
            .all()
        )

        print()
        print(
            f"Authorized test people: "
            f"{len(people)}"
        )

        if not people:

            print(
                "No enrolled people found."
            )

            print(
                "Run register_person.py first."
            )

            return

        engine = (
            RecognitionEngine()
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
            "================================"
        )
        print(
            "SMART CAMPUS VISION"
        )
        print(
            "LOCAL RECOGNITION TEST"
        )
        print(
            "================================"
        )
        print(
            "Press Q to exit."
        )
        print()

        while True:

            success, frame = (
                camera.read()
            )

            if not success:

                print(
                    "Failed to read frame."
                )

                break

            results = engine.recognize(
                frame,
                people,
            )

            for result in results:

                draw_result(
                    frame,
                    result,
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

            cv2.imshow(
                "Smart Campus Vision",
                frame,
            )

            key = (
                cv2.waitKey(1)
                & 0xFF
            )

            if key == ord("q"):

                break

    finally:

        db.close()

        try:
            camera.release()
        except:
            pass

        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()