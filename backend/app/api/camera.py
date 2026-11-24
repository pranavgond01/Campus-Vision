from __future__ import annotations

import threading
import time
from datetime import datetime
from typing import Any, Optional

import cv2
import numpy as np

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core.config import (
    DEFAULT_CAMERA_ID,
    FACE_MATCH_THRESHOLD,
)

from app.database.database import get_db

from app.database.models import (
    Person,
    RecognitionEvent,
)

from services.face_service import (
    cosine_similarity,
    extract_feature,
    bytes_to_feature,
)

from app.api.recognition import (
    detect_faces,
    crop_face,
    find_best_match,
)


router = APIRouter(
    prefix="/api/camera",
    tags=["Camera"],
)


# ============================================================
# CAMERA STATE
# ============================================================

_camera_lock = threading.RLock()

_camera: Optional[cv2.VideoCapture] = None

_camera_running = False

_is_simulated = False

_sim_step = 0

_camera_error: Optional[str] = None

_camera_started_at: Optional[float] = None


# ============================================================
# RECOGNITION STATE
# ============================================================

_latest_frame: Optional[np.ndarray] = None

_latest_results: list[dict[str, Any]] = []

_processing_lock = threading.Lock()

_processing_thread: Optional[threading.Thread] = None

_processing_running = False

_last_event_logged: dict[str, float] = {}


# ============================================================
# CAMERA ACCESS
# ============================================================

def get_camera() -> Optional[cv2.VideoCapture]:

    global _camera

    with _camera_lock:

        if _camera is not None and _camera.isOpened():
            return _camera

        try:
            cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            if cap.isOpened():
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                cap.set(cv2.CAP_PROP_FPS, 30)
                ret, test_frame = cap.read()
                if ret and test_frame is not None:
                    _camera = cap
                    return _camera
                cap.release()
        except Exception:
            pass

        return None


# ============================================================
# START CAMERA
# ============================================================

def start_camera() -> bool:

    global _camera_running
    global _camera_error
    global _camera_started_at
    global _is_simulated

    with _camera_lock:

        if _camera_running:
            return True

        camera = get_camera()

        if camera is None:
            _is_simulated = True
            _camera_error = None
        else:
            _is_simulated = False
            _camera_error = None

        _camera_running = True
        _camera_started_at = time.time()

    start_processing_thread()

    return True


# ============================================================
# STOP CAMERA
# ============================================================

def stop_camera() -> None:

    global _camera
    global _camera_running
    global _camera_started_at
    global _is_simulated

    with _camera_lock:

        _camera_running = False
        _is_simulated = False
        _camera_started_at = None

        if _camera is not None:

            try:
                _camera.release()
            except Exception:
                pass

            _camera = None


# ============================================================
# READ CAMERA FRAME
# ============================================================

def read_frame():

    global _camera_error
    global _sim_step

    with _camera_lock:

        if not _camera_running:
            return None

        if _is_simulated or _camera is None:
            # Generate simulated campus camera frame
            _sim_step = (_sim_step + 1) % 1000
            frame = np.zeros((720, 1280, 3), dtype=np.uint8)
            frame[:] = (20, 16, 12)  # dark slate theme

            # Subtle grid
            for x in range(0, 1280, 80):
                cv2.line(frame, (x, 0), (x, 720), (35, 28, 22), 1)
            for y in range(0, 720, 80):
                cv2.line(frame, (0, y), (1280, y), (35, 28, 22), 1)

            # Scanner line
            scan_y = int((time.time() * 120) % 720)
            cv2.line(frame, (0, scan_y), (1280, scan_y), (109, 93, 252), 2)

            # Center target reticle
            cx, cy = 640, 360
            cv2.circle(frame, (cx, cy), 130, (70, 60, 50), 2)
            cv2.circle(frame, (cx, cy), 4, (109, 93, 252), -1)

            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cv2.putText(
                frame,
                f"SMART CAMPUS VISION | {DEFAULT_CAMERA_ID}",
                (30, 45),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.75,
                (255, 255, 255),
                2,
                cv2.LINE_AA,
            )
            cv2.putText(
                frame,
                f"LIVE MONITOR: {now_str}",
                (30, 80),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (100, 200, 120),
                1,
                cv2.LINE_AA,
            )
            cv2.putText(
                frame,
                "Ready for face verification | Position face in center",
                (cx - 250, cy + 180),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (160, 160, 180),
                2,
                cv2.LINE_AA,
            )

            return frame

        success, frame = _camera.read()

        if not success:

            _camera_error = (
                "Unable to read frame from webcam."
            )

            return None

        _camera_error = None

        return frame


# ============================================================
# DATABASE PEOPLE
# ============================================================

def load_enrolled_people(
    db,
) -> list[Person]:

    return (
        db.query(Person)
        .filter(
            Person.face_embedding.isnot(None)
        )
        .all()
    )


# ============================================================
# RECOGNIZE SINGLE FACE
# ============================================================

def recognize_face_crop(
    face_crop: np.ndarray,
    people: list[Person],
):

    try:

        feature = extract_feature(
            face_crop
        )

    except Exception:

        return {
            "matched": False,
            "person": None,
            "confidence": 0.0,
        }

    person, similarity = find_best_match(
        feature,
        people,
    )

    similarity = max(
        0.0,
        float(similarity),
    )

    matched = (
        person is not None
        and similarity >= FACE_MATCH_THRESHOLD
    )

    if not matched:

        return {
            "matched": False,
            "person": None,
            "confidence": similarity,
        }

    return {
        "matched": True,
        "person": person,
        "confidence": similarity,
    }


# ============================================================
# PROCESS FRAME
# ============================================================

def process_frame(
    frame: np.ndarray,
) -> tuple[np.ndarray, list[dict[str, Any]]]:

    output = frame.copy()

    try:

        faces = detect_faces(frame)

    except Exception as exc:

        cv2.putText(
            output,
            "FACE DETECTOR ERROR",
            (25, 45),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 0, 255),
            2,
            cv2.LINE_AA,
        )

        return output, []

    if not faces:

        cv2.putText(
            output,
            "NO FACE DETECTED",
            (25, 45),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (180, 180, 180),
            2,
            cv2.LINE_AA,
        )

        return output, []

    db = next(get_db())

    try:

        people = load_enrolled_people(
            db
        )

        results = []

        for face in faces:

            x = face["x"]
            y = face["y"]

            width = face["width"]
            height = face["height"]

            face_crop = crop_face(
                frame,
                face,
            )

            if face_crop is None:

                continue

            recognition = recognize_face_crop(
                face_crop,
                people,
            )

            matched = recognition[
                "matched"
            ]

            person = recognition[
                "person"
            ]

            confidence = recognition[
                "confidence"
            ]

            if matched and person is not None:

                display_name = (
                    person.full_name
                )

                enrollment_no = (
                    person.enrollment_no
                    or "N/A"
                )

                role = (
                    person.role
                    or "student"
                )

                status = "recognized"

            else:

                display_name = "UNKNOWN"

                enrollment_no = ""

                role = ""

                status = "unknown"

            # Log recognition event with cooldown (60 seconds per person)
            event_key = f"person_{person.id}" if (matched and person) else "unknown"
            current_time = time.time()
            if current_time - _last_event_logged.get(event_key, 0) > 60.0:
                _last_event_logged[event_key] = current_time
                try:
                    event = RecognitionEvent(
                        person_id=person.id if (matched and person) else None,
                        camera_id=DEFAULT_CAMERA_ID,
                        confidence=round(confidence, 4),
                        status=status,
                    )
                    db.add(event)
                    db.commit()
                except Exception as exc:
                    db.rollback()

            results.append(
                {
                    "person_id": person.id if (matched and person) else None,
                    "full_name": display_name if (matched and person) else "Unknown Person",
                    "name": display_name,
                    "role": role if (matched and person) else None,
                    "enrollment_no": enrollment_no if (matched and person) else None,
                    "year": person.year if (matched and person) else None,
                    "branch": person.branch if (matched and person) else None,
                    "confidence": round(confidence, 4),
                    "status": "MATCHED" if matched else "UNKNOWN",
                    "x": x,
                    "y": y,
                    "width": width,
                    "height": height,
                }
            )

            # ------------------------------------------------
            # Bounding box
            # ------------------------------------------------

            if matched:

                box_color = (
                    40,
                    210,
                    110,
                )

            else:

                box_color = (
                    40,
                    60,
                    235,
                )

            cv2.rectangle(
                output,
                (x, y),
                (
                    x + width,
                    y + height,
                ),
                box_color,
                2,
            )

            # ------------------------------------------------
            # Label
            # ------------------------------------------------

            confidence_percent = (
                confidence * 100
            )

            if matched:

                label = (
                    f"{display_name} | "
                    f"{enrollment_no} | "
                    f"{confidence_percent:.1f}%"
                )

            else:

                label = (
                    f"UNKNOWN | "
                    f"{confidence_percent:.1f}%"
                )

            font = (
                cv2.FONT_HERSHEY_SIMPLEX
            )

            font_scale = 0.55

            thickness = 2

            (
                text_width,
                text_height,
            ), baseline = cv2.getTextSize(
                label,
                font,
                font_scale,
                thickness,
            )

            label_y = max(
                text_height + 12,
                y,
            )

            cv2.rectangle(
                output,
                (
                    x,
                    label_y - text_height - 12,
                ),
                (
                    x + text_width + 12,
                    label_y + baseline - 5,
                ),
                box_color,
                -1,
            )

            cv2.putText(
                output,
                label,
                (
                    x + 6,
                    label_y - 5,
                ),
                font,
                font_scale,
                (255, 255, 255),
                thickness,
                cv2.LINE_AA,
            )

        return output, results

    finally:

        db.close()


# ============================================================
# BACKGROUND PROCESSOR
# ============================================================

def processing_loop():

    global _processing_running
    global _latest_frame
    global _latest_results

    _processing_running = True

    try:

        while _camera_running:

            frame = read_frame()

            if frame is None:

                time.sleep(0.05)

                continue

            try:

                processed_frame, results = (
                    process_frame(frame)
                )

                with _processing_lock:

                    _latest_frame = (
                        processed_frame
                    )

                    _latest_results = results

            except Exception as exc:

                error_frame = frame.copy()

                cv2.putText(
                    error_frame,
                    "PROCESSING ERROR",
                    (25, 45),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.9,
                    (0, 0, 255),
                    2,
                    cv2.LINE_AA,
                )

                with _processing_lock:

                    _latest_frame = error_frame

                    _latest_results = []

                print(
                    f"[CAMERA] Processing error: {exc}"
                )

            time.sleep(0.01)

    finally:

        _processing_running = False

_last_event_logged: dict[str, float] = {}


# ============================================================
# START PROCESSING THREAD
# ============================================================

def start_processing_thread():

    global _processing_thread

    if (
        _processing_thread is not None
        and _processing_thread.is_alive()
    ):
        return

    _processing_thread = threading.Thread(
        target=processing_loop,
        daemon=True,
        name="smart-campus-camera",
    )

    _processing_thread.start()


# ============================================================
# MJPEG GENERATOR
# ============================================================

def generate_frames():

    while _camera_running:

        with _processing_lock:

            frame = (
                None
                if _latest_frame is None
                else _latest_frame.copy()
            )

        if frame is None:

            time.sleep(0.05)

            continue

        success, encoded = (
            cv2.imencode(
                ".jpg",
                frame,
                [
                    cv2.IMWRITE_JPEG_QUALITY,
                    85,
                ],
            )
        )

        if not success:

            continue

        frame_bytes = encoded.tobytes()

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame_bytes
            + b"\r\n"
        )

        time.sleep(0.03)


# ============================================================
# STATUS
# ============================================================

@router.get("/status")
def camera_status():

    with _processing_lock:

        detections = len(
            _latest_results
        )

    return {
        "success": True,

        "camera_id": (
            DEFAULT_CAMERA_ID
        ),

        "running": (
            _camera_running
        ),

        "available": True,

        "is_simulated": _is_simulated,

        "processing": (
            _processing_running
        ),

        "detections": detections,

        "error": _camera_error,

        "started_at": (
            _camera_started_at
            if _camera_running
            else None
        ),
    }


# ============================================================
# LATEST RECOGNITION RESULTS
# ============================================================

@router.get("/results")
def camera_results():

    with _processing_lock:

        return [
            dict(item)
            for item in _latest_results
        ]


@router.get("/detections")
def camera_detections():

    with _processing_lock:

        detections = [
            dict(item)
            for item in _latest_results
        ]

    return {
        "success": True,

        "camera_id": (
            DEFAULT_CAMERA_ID
        ),

        "running": (
            _camera_running
        ),

        "count": len(
            detections
        ),

        "detections": detections,
    }


# ============================================================
# START
# ============================================================

@router.post("/start")
def start_camera_endpoint():

    started = start_camera()

    if not started:

        return {
            "success": False,

            "camera_id": (
                DEFAULT_CAMERA_ID
            ),

            "running": False,

            "message": (
                _camera_error
                or "Could not start camera."
            ),
        }

    return {
        "success": True,

        "camera_id": (
            DEFAULT_CAMERA_ID
        ),

        "running": True,

        "message": (
            "Smart Campus Vision camera "
            "started."
        ),
    }


# ============================================================
# STOP
# ============================================================

@router.post("/stop")
def stop_camera_endpoint():

    stop_camera()

    return {
        "success": True,

        "camera_id": (
            DEFAULT_CAMERA_ID
        ),

        "running": False,

        "message": (
            "Smart Campus Vision camera "
            "stopped."
        ),
    }


# ============================================================
# STREAM
# ============================================================

@router.get("/stream")
def camera_stream():

    if not _camera_running:

        started = start_camera()

        if not started:

            return {
                "success": False,
                "message": (
                    _camera_error
                    or "Camera unavailable."
                ),
            }

    return StreamingResponse(
        generate_frames(),
        media_type=(
            "multipart/x-mixed-replace; "
            "boundary=frame"
        ),
    )