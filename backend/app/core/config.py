from pathlib import Path


# ============================================================
# PROJECT
# ============================================================

BASE_DIR = Path(
    __file__
).resolve().parents[2]


# ============================================================
# DIRECTORIES
# ============================================================

MODELS_DIR = BASE_DIR / "models"

DATA_DIR = BASE_DIR / "data"

FACES_DIR = DATA_DIR / "faces"

ID_CARDS_DIR = DATA_DIR / "id_cards"


DATA_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

FACES_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

ID_CARDS_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


# ============================================================
# MODELS
# ============================================================

YUNET_MODEL = (
    MODELS_DIR
    / "yunet"
    / "face_detection_yunet_2023mar.onnx"
)


SFACE_MODEL = (
    MODELS_DIR
    / "sface"
    / "face_recognition_sface_2021dec.onnx"
)


# ============================================================
# DATABASE
# ============================================================

DATABASE_PATH = (
    DATA_DIR
    / "smart_campus.db"
)


DATABASE_URL = (
    f"sqlite:///{DATABASE_PATH}"
)


# ============================================================
# FACE RECOGNITION
# ============================================================

FACE_MATCH_THRESHOLD = 0.310

FACE_DETECTION_THRESHOLD = 0.65

FACE_NMS_THRESHOLD = 0.30


# ============================================================
# CAMERA
# ============================================================

CAMERA_INDEX = 0

CAMERA_WIDTH = 1280

CAMERA_HEIGHT = 720

CAMERA_FPS = 30


# ============================================================
# STREAM
# ============================================================

STREAM_JPEG_QUALITY = 80


# ============================================================
# CAMERA ID
# ============================================================

DEFAULT_CAMERA_ID = (
    "LOCAL-CAMERA-01"
)