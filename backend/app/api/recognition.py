from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)

from sqlalchemy.orm import Session

from app.core.config import (
    DEFAULT_CAMERA_ID,
    FACE_MATCH_THRESHOLD,
    SFACE_MODEL,
    YUNET_MODEL,
)

from app.database.database import (
    SessionLocal,
    get_db,
)

from app.database.models import (
    Person,
    RecognitionEvent,
)

from services.face_service import (
    base64_to_image,
    bytes_to_feature,
    bytes_to_features,
    cosine_similarity,
    extract_feature,
    FACE_RECOGNIZER,
)

from .schemas import (
    RecognitionMatch,
    RecognitionRequest,
    RecognitionResponse,
)


router = APIRouter(
    prefix="/api/recognition",
    tags=["Recognition"],
)


# ============================================================
# REALTIME CONFIGURATION
# ============================================================

REALTIME_MAX_WIDTH = 960

REALTIME_EVENT_COOLDOWN = 10.0

REALTIME_MIN_DETECTION_CONFIDENCE = 0.65

REALTIME_FRAME_INTERVAL = 0.10


# ============================================================
# YUNET
# ============================================================

FACE_DETECTOR = None


def load_detector():
    global FACE_DETECTOR

    if FACE_DETECTOR is not None:
        return FACE_DETECTOR

    if not YUNET_MODEL.is_file():
        raise RuntimeError(
            "YuNet model not found:\n"
            f"{YUNET_MODEL}"
        )

    FACE_DETECTOR = cv2.FaceDetectorYN.create(
        str(YUNET_MODEL),
        "",
        (320, 320),
        0.60,
        0.30,
        5000,
    )

    return FACE_DETECTOR


# ============================================================
# FACE DETECTION
# ============================================================

def detect_faces(
    image: np.ndarray,
) -> list[dict[str, Any]]:

    detector = load_detector()

    height, width = image.shape[:2]

    if width <= 0 or height <= 0:
        return []

    detector.setInputSize(
        (width, height)
    )

    try:
        _, faces = detector.detect(
            image
        )

    except Exception as exc:
        raise RuntimeError(
            f"YuNet detection failed: {exc}"
        )

    if faces is None:
        return []

    results: list[dict[str, Any]] = []

    for face in faces:

        x = max(
            0,
            int(face[0]),
        )

        y = max(
            0,
            int(face[1]),
        )

        w = int(face[2])

        h = int(face[3])

        confidence = float(
            face[-1]
        )

        if w < 50 or h < 50:
            continue

        if (
            confidence
            < REALTIME_MIN_DETECTION_CONFIDENCE
        ):
            continue

        x = min(
            x,
            max(0, width - 1),
        )

        y = min(
            y,
            max(0, height - 1),
        )

        w = min(
            w,
            width - x,
        )

        h = min(
            h,
            height - y,
        )

        if w <= 0 or h <= 0:
            continue

        results.append(
            {
                "x": x,
                "y": y,
                "width": w,
                "height": h,
                "confidence": confidence,
                "landmarks": face[4:14],
                "raw_face": face,
            }
        )

    return results


# ============================================================
# IMAGE RESIZE
# ============================================================

def resize_for_realtime(
    image: np.ndarray,
) -> tuple[np.ndarray, float]:

    height, width = image.shape[:2]

    if width <= REALTIME_MAX_WIDTH:
        return image, 1.0

    scale = (
        REALTIME_MAX_WIDTH
        / float(width)
    )

    new_width = REALTIME_MAX_WIDTH

    new_height = int(
        height * scale
    )

    resized = cv2.resize(
        image,
        (
            new_width,
            new_height,
        ),
        interpolation=cv2.INTER_AREA,
    )

    return (
        resized,
        scale,
    )


# ============================================================
# FACE CROP
# ============================================================

def crop_face(
    image: np.ndarray,
    face: dict[str, Any],
) -> np.ndarray | None:

    x = face["x"]
    y = face["y"]

    w = face["width"]
    h = face["height"]

    padding = int(
        max(w, h) * 0.20
    )

    x1 = max(
        0,
        x - padding,
    )

    y1 = max(
        0,
        y - padding,
    )

    x2 = min(
        image.shape[1],
        x + w + padding,
    )

    y2 = min(
        image.shape[0],
        y + h + padding,
    )

    if x2 <= x1 or y2 <= y1:
        return None

    crop = image[
        y1:y2,
        x1:x2,
    ]

    if crop.size == 0:
        return None

    return crop


# ============================================================
# DATABASE PEOPLE
# ============================================================

def load_enrolled_people(
    db: Session,
) -> list[Person]:

    return (
        db.query(Person)
        .filter(
            Person.face_embedding.isnot(None)
        )
        .all()
    )


# ============================================================
# BEST MATCH
# ============================================================

def find_best_match(
    feature: np.ndarray,
    people: list[Person],
) -> tuple[
    Person | None,
    float,
]:

    best_person = None

    best_similarity = -1.0

    for person in people:

        if not person.face_embedding:
            continue

        try:
            person_features = bytes_to_features(
                person.face_embedding
            )

            if not person_features:
                continue

            similarity = max(
                cosine_similarity(
                    feature,
                    stored_f,
                )
                for stored_f in person_features
            )

        except Exception:
            continue

        if similarity > best_similarity:

            best_similarity = similarity

            best_person = person

    return (
        best_person,
        best_similarity,
    )


# ============================================================
# MATCH RESULT
# ============================================================

@dataclass
class FaceRecognitionResult:

    x: int

    y: int

    width: int

    height: int

    detector_confidence: float

    recognition_confidence: float

    matched: bool

    label: str

    enrollment_no: str | None

    person_id: int | None


# ============================================================
# RECOGNIZE SINGLE FACE
# ============================================================

def recognize_single_face(
    image: np.ndarray,
    face: dict[str, Any],
    people: list[Person],
) -> FaceRecognitionResult | None:

    feature = None

    # 1. Prefer landmark alignCrop for canonical 112x112 frontal alignment
    if "raw_face" in face and FACE_RECOGNIZER is not None:
        try:
            aligned = FACE_RECOGNIZER.alignCrop(
                image,
                face["raw_face"],
            )
            if aligned is not None and aligned.size > 0:
                feature = extract_feature(aligned)
        except Exception:
            feature = None

    # 2. Fallback to bounding box crop if alignCrop fails
    if feature is None:
        face_crop = crop_face(
            image,
            face,
        )

        if face_crop is None:
            return None

        try:
            feature = extract_feature(
                face_crop
            )
        except Exception:
            return FaceRecognitionResult(
                x=face["x"],
                y=face["y"],
                width=face["width"],
                height=face["height"],
                detector_confidence=round(
                    float(
                        face["confidence"]
                    ),
                    4,
                ),
                recognition_confidence=0.0,
                matched=False,
                label="UNKNOWN",
                enrollment_no=None,
                person_id=None,
            )

    best_person = None

    similarity = -1.0

    if people:

        best_person, similarity = (
            find_best_match(
                feature,
                people,
            )
        )

    similarity = max(
        0.0,
        float(similarity),
    )

    matched = (
        best_person is not None
        and similarity
        >= FACE_MATCH_THRESHOLD
    )

    if matched:

        return FaceRecognitionResult(
            x=face["x"],
            y=face["y"],
            width=face["width"],
            height=face["height"],
            detector_confidence=round(
                float(
                    face["confidence"]
                ),
                4,
            ),
            recognition_confidence=round(
                similarity,
                4,
            ),
            matched=True,
            label=(
                best_person.full_name
            ),
            enrollment_no=(
                best_person.enrollment_no
            ),
            person_id=(
                best_person.id
            ),
        )

    return FaceRecognitionResult(
        x=face["x"],
        y=face["y"],
        width=face["width"],
        height=face["height"],
        detector_confidence=round(
            float(
                face["confidence"]
            ),
            4,
        ),
        recognition_confidence=round(
            similarity,
            4,
        ),
        matched=False,
        label="UNKNOWN",
        enrollment_no=None,
        person_id=None,
    )


# ============================================================
# SERIALIZE RESULT
# ============================================================

def serialize_result(
    result: FaceRecognitionResult,
) -> dict[str, Any]:

    return {
        "x": result.x,
        "y": result.y,
        "width": result.width,
        "height": result.height,
        "detector_confidence": (
            result.detector_confidence
        ),
        "confidence": (
            result.recognition_confidence
        ),
        "matched": result.matched,
        "label": result.label,
        "enrollment_no": (
            result.enrollment_no
        ),
        "person_id": result.person_id,
    }


# ============================================================
# EVENT LOGGER
# ============================================================

class RecognitionEventLogger:

    def __init__(
        self,
        cooldown: float = 90.0,
    ):
        self.cooldown = cooldown
        self.last_logged: dict[str, float] = {}
        self.last_matched_at: dict[str, float] = {}

    def should_log_matched(
        self,
        camera_id: str,
        person_id: int,
    ) -> bool:
        key = f"{camera_id}:person_{person_id}"
        now = time.monotonic()
        previous = self.last_logged.get(key, 0.0)

        # Record that a verified person is active at this camera
        self.last_matched_at[camera_id] = now

        if now - previous < self.cooldown:
            return False

        self.last_logged[key] = now
        return True

    def should_log_unknown(
        self,
        camera_id: str,
    ) -> bool:
        now = time.monotonic()

        # If a verified person was at this camera within cooldown, suppress unknown logs
        if now - self.last_matched_at.get(camera_id, 0.0) < self.cooldown:
            return False

        key = f"{camera_id}:unknown"
        previous = self.last_logged.get(key, 0.0)

        # Log unknown at most once every 120 seconds per camera
        if now - previous < 120.0:
            return False

        self.last_logged[key] = now
        return True

    def should_log(
        self,
        camera_id: str,
        person_key: str,
    ) -> bool:
        if person_key.startswith("person_"):
            try:
                pid = int(person_key.split("_")[1])
                return self.should_log_matched(camera_id, pid)
            except Exception:
                pass
        return self.should_log_unknown(camera_id)

    def clear_expired(self):

        now = time.monotonic()

        expired = [
            key
            for key, timestamp
            in self.last_logged.items()
            if now - timestamp
            > self.cooldown * 3
        ]

        for key in expired:
            self.last_logged.pop(
                key,
                None,
            )


# ============================================================
# REALTIME RECOGNITION ENGINE
# ============================================================

def recognize_frame(
    image: np.ndarray,
    db: Session,
    camera_id: str,
    event_logger: RecognitionEventLogger,
) -> dict[str, Any]:

    started = time.perf_counter()

    processed_image, scale = (
        resize_for_realtime(
            image
        )
    )

    faces = detect_faces(
        processed_image
    )

    if not faces:

        return {
            "success": True,
            "detected": False,
            "matched": False,
            "face_count": 0,
            "camera_id": camera_id,
            "faces": [],
            "processing_ms": round(
                (
                    time.perf_counter()
                    - started
                )
                * 1000,
                2,
            ),
            "frame_width": (
                processed_image.shape[1]
            ),
            "frame_height": (
                processed_image.shape[0]
            ),
        }

    people = load_enrolled_people(
        db
    )

    results: list[
        FaceRecognitionResult
    ] = []

    for face in faces:

        result = (
            recognize_single_face(
                processed_image,
                face,
                people,
            )
        )

        if result is None:
            continue

        results.append(result)

        # ----------------------------------------------------
        # Log recognized people with cooldown.
        # ----------------------------------------------------

        if result.matched:

            person_key = (
                str(result.person_id)
            )

        else:

            person_key = (
                "unknown"
            )

        if event_logger.should_log(
            camera_id,
            person_key,
        ):

            event = RecognitionEvent(
                person_id=(
                    result.person_id
                    if result.matched
                    else None
                ),
                camera_id=camera_id,
                confidence=(
                    result.recognition_confidence
                ),
                status=(
                    "recognized"
                    if result.matched
                    else "unknown"
                ),
            )

            db.add(event)

    db.commit()

    event_logger.clear_expired()

    # --------------------------------------------------------
    # Convert coordinates back to original frame.
    # --------------------------------------------------------

    serialized_faces = []

    for result in results:

        if scale != 1.0:

            x = int(
                result.x / scale
            )

            y = int(
                result.y / scale
            )

            width = int(
                result.width / scale
            )

            height = int(
                result.height / scale
            )

        else:

            x = result.x
            y = result.y
            width = result.width
            height = result.height

        item = serialize_result(
            result
        )

        item["x"] = x
        item["y"] = y
        item["width"] = width
        item["height"] = height

        serialized_faces.append(
            item
        )

    matched_count = sum(
        1
        for result in results
        if result.matched
    )

    unknown_count = (
        len(results)
        - matched_count
    )

    return {
        "success": True,
        "detected": True,
        "matched": matched_count > 0,
        "face_count": len(results),
        "recognized_count": (
            matched_count
        ),
        "unknown_count": (
            unknown_count
        ),
        "camera_id": camera_id,
        "faces": serialized_faces,
        "processing_ms": round(
            (
                time.perf_counter()
                - started
            )
            * 1000,
            2,
        ),
        "frame_width": (
            image.shape[1]
        ),
        "frame_height": (
            image.shape[0]
        ),
    }


# ============================================================
# STANDARD POST RECOGNITION
# ============================================================

GLOBAL_EVENT_LOGGER = RecognitionEventLogger(cooldown=60.0)


@router.post(
    "",
    response_model=RecognitionResponse,
)
def recognize_face(
    request: RecognitionRequest,
    db: Session = Depends(get_db),
):

    camera_id = (
        request.camera_id.strip()
        if request.camera_id
        else DEFAULT_CAMERA_ID
    )

    try:

        image = base64_to_image(
            request.image
        )

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=(
                "Could not decode image: "
                f"{exc}"
            ),
        )

    if image is None:

        raise HTTPException(
            status_code=400,
            detail="Invalid image.",
        )

    try:

        faces = detect_faces(
            image
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    if not faces:

        return RecognitionResponse(
            success=True,
            detected=False,
            matched=False,
            message="No face detected.",
            confidence=None,
            person=None,
            face_count=0,
            camera_id=camera_id,
        )

    people = load_enrolled_people(
        db
    )

    largest_face = max(
        faces,
        key=lambda item:
            item["width"]
            * item["height"],
    )

    result = (
        recognize_single_face(
            image,
            largest_face,
            people,
        )
    )

    if result is None:

        raise HTTPException(
            status_code=422,
            detail=(
                "Face was detected but "
                "could not be cropped."
            ),
        )

    # --------------------------------------------------------
    # Recognized
    # --------------------------------------------------------

    if result.matched:

        person_key = f"person_{result.person_id}"

        if GLOBAL_EVENT_LOGGER.should_log(camera_id, person_key):

            event = RecognitionEvent(
                person_id=result.person_id,
                camera_id=camera_id,
                confidence=(
                    result.recognition_confidence
                ),
                status="recognized",
            )

            db.add(event)

            db.commit()

        person = next(
            (
                person
                for person in people
                if person.id
                == result.person_id
            ),
            None,
        )

        if person is None:

            raise HTTPException(
                status_code=500,
                detail=(
                    "Recognized person "
                    "could not be loaded."
                ),
            )

        person_response = (
            RecognitionMatch(
                person_id=person.id,
                full_name=(
                    person.full_name
                ),
                enrollment_no=(
                    person.enrollment_no
                ),
                role=person.role,
                branch=person.branch,
                year=person.year,
                date_of_birth=person.date_of_birth,
                contact_number=person.contact_number,
                validity=person.validity,
                face_image=person.face_image,
                confidence=round(
                    result.recognition_confidence,
                    4,
                ),
                matched=True,
            )
        )

        return RecognitionResponse(
            success=True,
            detected=True,
            matched=True,
            message=(
                "Face recognized successfully."
            ),
            confidence=round(
                result.recognition_confidence,
                4,
            ),
            person=person_response,
            face_count=len(faces),
            camera_id=camera_id,
            box={
                "x": result.x,
                "y": result.y,
                "width": result.width,
                "height": result.height,
            },
        )

    # --------------------------------------------------------
    # Unknown
    # --------------------------------------------------------

    person_key = "unknown"

    if GLOBAL_EVENT_LOGGER.should_log(camera_id, person_key):

        event = RecognitionEvent(
            person_id=None,
            camera_id=camera_id,
            confidence=(
                result.recognition_confidence
            ),
            status="unknown",
        )

        db.add(event)

        db.commit()

    return RecognitionResponse(
        success=True,
        detected=True,
        matched=False,
        message=(
            "Face detected but "
            "person is not recognized."
        ),
        confidence=round(
            result.recognition_confidence,
            4,
        ),
        person=None,
        face_count=len(faces),
        camera_id=camera_id,
        box={
            "x": result.x,
            "y": result.y,
            "width": result.width,
            "height": result.height,
        },
    )


# ============================================================
# REALTIME WEBSOCKET
# ============================================================

@router.websocket(
    "/ws/{camera_id}"
)
async def realtime_recognition(
    websocket: WebSocket,
    camera_id: str,
):

    await websocket.accept()

    db = SessionLocal()

    event_logger = (
        RecognitionEventLogger()
    )

    try:

        await websocket.send_json(
            {
                "type": "connection",
                "success": True,
                "camera_id": camera_id,
                "message": (
                    "Smart Campus Vision "
                    "camera connected."
                ),
            }
        )

        while True:

            try:

                payload = (
                    await websocket.receive_json()
                )

            except WebSocketDisconnect:
                raise

            except Exception as exc:

                await websocket.send_json(
                    {
                        "type": "error",
                        "success": False,
                        "error": (
                            "Invalid WebSocket "
                            f"payload: {exc}"
                        ),
                    }
                )

                continue

            image_data = payload.get(
                "image"
            )

            if not image_data:

                await websocket.send_json(
                    {
                        "type": "error",
                        "success": False,
                        "error": (
                            "Image is required."
                        ),
                    }
                )

                continue

            try:

                image = base64_to_image(
                    image_data
                )

            except Exception as exc:

                await websocket.send_json(
                    {
                        "type": "error",
                        "success": False,
                        "error": (
                            "Could not decode "
                            f"image: {exc}"
                        ),
                    }
                )

                continue

            if image is None:

                await websocket.send_json(
                    {
                        "type": "error",
                        "success": False,
                        "error": (
                            "Invalid image."
                        ),
                    }
                )

                continue

            try:

                result = recognize_frame(
                    image=image,
                    db=db,
                    camera_id=camera_id,
                    event_logger=event_logger,
                )

                result["type"] = (
                    "recognition"
                )

                await websocket.send_json(
                    result
                )

            except Exception as exc:

                db.rollback()

                await websocket.send_json(
                    {
                        "type": "error",
                        "success": False,
                        "error": str(exc),
                    }
                )

            await asyncio.sleep(
                REALTIME_FRAME_INTERVAL
            )

    except WebSocketDisconnect:

        pass

    finally:

        db.close()


# ============================================================
# EVENTS
# ============================================================

@router.get("/events")
def get_recognition_events(
    limit: int = 100,
    db: Session = Depends(get_db),
):

    events = (
        db.query(RecognitionEvent)
        .order_by(RecognitionEvent.timestamp.desc())
        .limit(limit)
        .all()
    )

    result = []
    for event in events:
        person_info = None
        if event.person_id:
            person = (
                db.query(Person)
                .filter(Person.id == event.person_id)
                .first()
            )
            if person:
                person_info = {
                    "id": person.id,
                    "full_name": person.full_name,
                    "role": person.role,
                    "enrollment_no": person.enrollment_no,
                    "branch": person.branch,
                    "year": person.year,
                }

        result.append(
            {
                "id": event.id,
                "person_id": event.person_id,
                "camera_id": event.camera_id,
                "confidence": round(event.confidence, 4),
                "status": event.status,
                "timestamp": (
                    event.timestamp.isoformat()
                    if event.timestamp
                    else None
                ),
                "person": person_info,
            }
        )

    return result


# ============================================================
# HEALTH
# ============================================================

@router.get("/health")
def recognition_health():

    return {
        "success": True,
        "service": "face-recognition",
        "status": "ready",
        "realtime": True,
        "yunet_model": (
            str(YUNET_MODEL)
        ),
        "sface_model": (
            str(SFACE_MODEL)
        ),
        "threshold": (
            FACE_MATCH_THRESHOLD
        ),
        "realtime_max_width": (
            REALTIME_MAX_WIDTH
        ),
        "event_cooldown_seconds": (
            REALTIME_EVENT_COOLDOWN
        ),
        "frame_interval_seconds": (
            REALTIME_FRAME_INTERVAL
        ),
    }