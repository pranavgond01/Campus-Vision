from __future__ import annotations

import os
import re
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, Optional
from urllib.parse import urlparse

# Fast socket / RTSP timeout for FFmpeg
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|timeout;1500000|stimeout;1500000"

import cv2
import numpy as np

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

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

_current_source: str = "0"

_current_camera_id: str = DEFAULT_CAMERA_ID

_current_camera_name: str = "Local Webcam"


class CameraConnectRequest(BaseModel):
    source: Optional[str] = "0"
    camera_id: Optional[str] = DEFAULT_CAMERA_ID
    camera_name: Optional[str] = "Local Webcam"


class CameraScanRequest(BaseModel):
    source: str
    max_channels: Optional[int] = 16
    allow_simulation_fallback: Optional[bool] = False


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

def get_camera(source: str = "0") -> Optional[cv2.VideoCapture]:

    global _camera
    global _current_source

    with _camera_lock:

        source_str = str(source).strip() if source is not None else "0"
        if not source_str:
            source_str = "0"

        if _camera is not None and _camera.isOpened() and str(_current_source) == source_str:
            return _camera

        if _camera is not None:
            try:
                _camera.release()
            except Exception:
                pass
            _camera = None

        # Check if source is a numeric webcam index (e.g. 0, 1)
        if source_str.isdigit() or (source_str.startswith("-") and source_str[1:].isdigit()):
            src_idx = int(source_str)
            cap = None
            # On Windows, DirectShow (CAP_DSHOW) opens immediately without MSMF timeout delays
            for backend_api in [cv2.CAP_DSHOW, cv2.CAP_ANY]:
                try:
                    c = cv2.VideoCapture(src_idx, backend_api)
                    if c.isOpened():
                        ret, test_frame = c.read()
                        if ret and test_frame is not None:
                            cap = c
                            break
                        c.release()
                except Exception:
                    pass
            if cap is not None and cap.isOpened():
                try:
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                except Exception:
                    pass
                _camera = cap
                _current_source = source_str
                return _camera
            else:
                print(f"[CAMERA] Webcam index {src_idx} could not be opened (may be in use by another app or disconnected).")
        else:
            # RTSP, HTTP, or video file stream URI
            try:
                cap = cv2.VideoCapture(source_str, cv2.CAP_FFMPEG)
                if not cap.isOpened():
                    cap = cv2.VideoCapture(source_str)
                if cap.isOpened():
                    # Set buffer size to 1 to eliminate frame lag on RTSP
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                    ret, test_frame = cap.read()
                    if ret and test_frame is not None:
                        _camera = cap
                        _current_source = source_str
                        return _camera
                    cap.release()
            except Exception as exc:
                print(f"[CAMERA] RTSP open error: {exc}")

        return None


# ============================================================
# START CAMERA
# ============================================================

def start_camera(
    source: str = "0",
    camera_id: str = DEFAULT_CAMERA_ID,
    camera_name: str = "Local Webcam",
) -> bool:

    global _camera_running
    global _camera_error
    global _camera_started_at
    global _is_simulated
    global _current_source
    global _current_camera_id
    global _current_camera_name

    with _camera_lock:

        source_str = str(source).strip() if source is not None else "0"
        if not source_str:
            source_str = "0"

        # If already running with a different source, switch
        if _camera_running and str(_current_source) != source_str:
            stop_camera()

        _current_camera_id = camera_id or DEFAULT_CAMERA_ID
        _current_camera_name = camera_name or camera_id or "Camera"

        camera = get_camera(source_str)

        if camera is None:
            _is_simulated = True
            _camera_error = f"Stream offline at '{source_str}'. Running in simulated preview."
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

    _camera_running = False
    _is_simulated = False
    _camera_started_at = None

    time.sleep(0.06)

    with _camera_lock:
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
                        camera_id=_current_camera_id,
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
                    "date_of_birth": getattr(person, "date_of_birth", None) if (matched and person) else None,
                    "contact_number": getattr(person, "contact_number", None) if (matched and person) else None,
                    "validity": getattr(person, "validity", None) if (matched and person) else None,
                    "face_image": getattr(person, "face_image", None) if (matched and person) else None,
                    "confidence": round(confidence, 4),
                    "status": "MATCHED" if matched else "UNKNOWN",
                    "camera_id": _current_camera_id,
                    "camera_name": _current_camera_name,
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
        "camera_id": _current_camera_id,
        "camera_name": _current_camera_name,
        "source": _current_source,
        "running": _camera_running,
        "available": True,
        "is_simulated": _is_simulated,
        "processing": _processing_running,
        "detections": detections,
        "error": _camera_error,
        "started_at": (
            _camera_started_at
            if _camera_running
            else None
        ),
    }


# ============================================================
# PRESETS
# ============================================================

@router.get("/presets")
def camera_presets():

    return [
        {
            "id": "LOCAL-WEBCAM-01",
            "name": "Laptop / PC Webcam (0)",
            "source": "0",
            "location": "Local Machine",
            "type": "webcam",
        },
        {
            "id": "CAM-MAIN-GATE",
            "name": "Campus Main Entrance Gate",
            "source": "rtsp://admin:college123@192.168.1.101:554/Streaming/Channels/102",
            "location": "Main Entrance Gate",
            "type": "cctv",
        },
        {
            "id": "CAM-LIBRARY",
            "name": "Central Library Entry",
            "source": "rtsp://admin:college123@192.168.1.102:554/Streaming/Channels/102",
            "location": "Library Corridor",
            "type": "cctv",
        },
        {
            "id": "CAM-CS-DEPT",
            "name": "Computer Science Dept Entry",
            "source": "rtsp://admin:college123@192.168.1.103:554/Streaming/Channels/102",
            "location": "CS Dept Block 2",
            "type": "cctv",
        },
    ]


# ============================================================
# CCTV CHANNEL DISCOVERY & AUTO-SCAN
# ============================================================

def resolve_channel_url(template_uri: str, channel: int) -> str:
    trimmed = (template_uri or "").strip()
    if not trimmed or trimmed.isdigit():
        return str(channel - 1) if channel >= 1 else "0"

    if "{ch}" in trimmed:
        return trimmed.replace("{ch}", str(channel))
    if "{channel}" in trimmed:
        return trimmed.replace("{channel}", str(channel))

    # Hikvision style: /Channels/102 or /Channels/101
    if re.search(r"/Channels/\d+", trimmed, re.IGNORECASE):
        return re.sub(r"/Channels/\d+", f"/Channels/{channel}02", trimmed, flags=re.IGNORECASE)

    # Dahua / CP Plus style: channel=1
    if re.search(r"channel=\d+", trimmed, re.IGNORECASE):
        return re.sub(r"channel=\d+", f"channel={channel}", trimmed, flags=re.IGNORECASE)

    # Generic NVR style: /ch1/
    if re.search(r"/ch\d+/", trimmed, re.IGNORECASE):
        return re.sub(r"/ch\d+/", f"/ch{channel}/", trimmed, flags=re.IGNORECASE)

    return trimmed


def check_host_accessible(source_uri: str) -> tuple[bool, str]:
    trimmed = source_uri.strip()
    if trimmed.isdigit() or trimmed in ("0", "1", "2"):
        return True, "localhost"
    try:
        parsed = urlparse(trimmed)
        host = parsed.hostname
        port = parsed.port or 554
        if not host:
            return True, ""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1.2)
        result = sock.connect_ex((host, port))
        sock.close()
        return (result == 0), host
    except Exception:
        return False, ""


def probe_channel(template_uri: str, channel_num: int) -> Optional[dict]:
    url = resolve_channel_url(template_uri, channel_num)
    try:
        cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            cap = cv2.VideoCapture(url)
        if cap.isOpened():
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            ret, frame = cap.read()
            if ret and frame is not None:
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 640)
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 360)
                cap.release()
                return {
                    "channel": channel_num,
                    "name": f"CCTV Camera {channel_num}",
                    "source": url,
                    "status": "online",
                    "resolution": f"{w}x{h}",
                    "type": "cctv",
                }
            cap.release()
    except Exception:
        pass
    return None


@router.post("/scan")
def scan_cctv_channels(req: CameraScanRequest):
    source_str = (req.source or "").strip()
    if not source_str:
        return {
            "success": False,
            "detected_count": 0,
            "cameras": [],
            "message": "Please provide an RTSP Stream URI or webcam index.",
        }

    # If numeric webcam index
    if source_str.isdigit():
        detected_webcams = []
        # Probe index 0 and 1 (standard laptop internal + USB webcam) with fast DSHOW
        for idx in range(2):
            cap = None
            for backend_api in [cv2.CAP_DSHOW, cv2.CAP_ANY]:
                try:
                    c = cv2.VideoCapture(idx, backend_api)
                    if c.isOpened():
                        ret, frame = c.read()
                        if ret and frame is not None:
                            cap = c
                            break
                        c.release()
                except Exception:
                    pass
            if cap is not None and cap.isOpened():
                try:
                    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
                    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
                    detected_webcams.append({
                        "channel": idx + 1,
                        "name": f"USB Webcam {idx}" if idx > 0 else "Default Laptop / PC Webcam (0)",
                        "source": str(idx),
                        "status": "online",
                        "resolution": f"{w}x{h}",
                        "location": "Local Host",
                        "type": "webcam",
                    })
                except Exception:
                    pass
                finally:
                    try:
                        cap.release()
                    except Exception:
                        pass
        return {
            "success": len(detected_webcams) > 0,
            "detected_count": len(detected_webcams),
            "cameras": detected_webcams,
            "message": f"Detected {len(detected_webcams)} local video device(s).",
        }

    # RTSP Stream Check
    is_accessible, host = check_host_accessible(source_str)
    max_ch = min(max(1, req.max_channels or 16), 32)
    online_cameras = []

    if is_accessible:
        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(probe_channel, source_str, ch) for ch in range(1, max_ch + 1)]
            for fut in futures:
                res = fut.result()
                if res is not None:
                    online_cameras.append(res)

        online_cameras.sort(key=lambda x: x["channel"])

    if len(online_cameras) > 0:
        return {
            "success": True,
            "detected_count": len(online_cameras),
            "cameras": online_cameras,
            "host": host,
            "is_simulated": False,
            "message": f"Successfully detected {len(online_cameras)} online CCTV camera(s) on NVR ({host}).",
        }

    # Fallback simulation only if user explicitly requests fallback
    if req.allow_simulation_fallback:
        sim_count = 4
        sim_cameras = [
            {
                "channel": ch,
                "name": f"Campus CCTV Camera {ch}",
                "source": resolve_channel_url(source_str, ch),
                "status": "simulated",
                "resolution": "1280x720",
                "location": f"Zone {ch}",
                "type": "cctv",
            }
            for ch in range(1, sim_count + 1)
        ]
        return {
            "success": True,
            "detected_count": len(sim_cameras),
            "cameras": sim_cameras,
            "is_simulated": True,
            "host": host,
            "message": f"NVR Host ({host or 'LAN'}) unreachable on current network. Loaded {sim_count} preview demo channels.",
        }

    if not is_accessible:
        return {
            "success": False,
            "detected_count": 0,
            "cameras": [],
            "host": host,
            "message": f"NVR host '{host or source_str}' is unreachable on port 554. Ensure laptop and NVR are on the same college Wi-Fi/LAN.",
        }

    return {
        "success": False,
        "detected_count": 0,
        "cameras": [],
        "host": host,
        "message": f"Connected to {host}, but no active video streams responded on channels 1-{max_ch}. Verify RTSP URI path.",
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
        "camera_id": _current_camera_id,
        "camera_name": _current_camera_name,
        "source": _current_source,
        "running": _camera_running,
        "count": len(
            detections
        ),
        "detections": detections,
    }


# ============================================================
# START
# ============================================================

@router.post("/start")
def start_camera_endpoint(req: Optional[CameraConnectRequest] = None):

    source = req.source if (req and req.source is not None and req.source.strip()) else _current_source
    camera_id = req.camera_id if (req and req.camera_id is not None and req.camera_id.strip()) else _current_camera_id
    camera_name = req.camera_name if (req and req.camera_name is not None and req.camera_name.strip()) else _current_camera_name

    started = start_camera(source=source, camera_id=camera_id, camera_name=camera_name)

    if not started:

        return {
            "success": False,
            "camera_id": _current_camera_id,
            "camera_name": _current_camera_name,
            "source": _current_source,
            "running": False,
            "is_simulated": _is_simulated,
            "message": (
                _camera_error
                or "Could not start camera."
            ),
        }

    return {
        "success": True,
        "camera_id": _current_camera_id,
        "camera_name": _current_camera_name,
        "source": _current_source,
        "running": True,
        "is_simulated": _is_simulated,
        "message": f"Connected to {_current_camera_name} ({_current_source})",
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