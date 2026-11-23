from __future__ import annotations

import base64
import os
from pathlib import Path

import cv2
import numpy as np


PROJECT_ROOT = Path(r"C:\SmartCampusVision")

SFACE_PATH = (
    PROJECT_ROOT
    / "backend"
    / "models"
    / "sface"
    / "face_recognition_sface_2021dec.onnx"
)


if not SFACE_PATH.is_file():
    raise RuntimeError(
        "SFace model not found:\n"
        f"{SFACE_PATH}"
    )


# ------------------------------------------------------------
# SFace
# ------------------------------------------------------------

FACE_RECOGNIZER = cv2.FaceRecognizerSF.create(
    str(SFACE_PATH),
    ""
)


print(f"SFACE MODEL: {SFACE_PATH}")
print("SFACE LOAD: OK")


# ------------------------------------------------------------
# Base64 utilities
# ------------------------------------------------------------

def base64_to_image(
    value: str,
) -> np.ndarray:

    if "," in value:
        value = value.split(",", 1)[1]

    data = base64.b64decode(value)

    array = np.frombuffer(
        data,
        dtype=np.uint8,
    )

    image = cv2.imdecode(
        array,
        cv2.IMREAD_COLOR,
    )

    if image is None:
        raise ValueError(
            "Could not decode face image."
        )

    return image


# ------------------------------------------------------------
# Face alignment
# ------------------------------------------------------------

def extract_feature(
    face_image: np.ndarray,
) -> np.ndarray:

    if face_image is None:
        raise ValueError(
            "Face image is empty."
        )

    height, width = face_image.shape[:2]

    if width < 20 or height < 20:
        raise ValueError(
            "Face image is too small."
        )

    # SFace works best with aligned faces.
    #
    # For the first version, we use the face
    # crop directly. Later we can use YuNet's
    # five facial landmarks for alignment.

    feature = FACE_RECOGNIZER.feature(
        face_image
    )

    if feature is None:
        raise RuntimeError(
            "SFace failed to generate embedding."
        )

    feature = np.asarray(
        feature,
        dtype=np.float32,
    )

    # Normalize embedding.
    norm = np.linalg.norm(
        feature
    )

    if norm > 0:
        feature = feature / norm

    return feature.reshape(-1)


# ------------------------------------------------------------
# Feature serialization
# ------------------------------------------------------------

def feature_to_bytes(
    feature: np.ndarray,
) -> bytes:

    feature = np.asarray(
        feature,
        dtype=np.float32,
    )

    return feature.tobytes()


def bytes_to_feature(
    value: bytes,
) -> np.ndarray:

    return np.frombuffer(
        value,
        dtype=np.float32,
    )


# ------------------------------------------------------------
# Similarity
# ------------------------------------------------------------

def cosine_similarity(
    feature_a: np.ndarray,
    feature_b: np.ndarray,
) -> float:

    a = np.asarray(
        feature_a,
        dtype=np.float32,
    ).reshape(-1)

    b = np.asarray(
        feature_b,
        dtype=np.float32,
    ).reshape(-1)

    denominator = (
        np.linalg.norm(a)
        * np.linalg.norm(b)
    )

    if denominator == 0:
        return 0.0

    similarity = (
        np.dot(a, b)
        / denominator
    )

    return float(similarity)


def compare_faces(
    feature_a: np.ndarray,
    feature_b: np.ndarray,
) -> dict:

    similarity = cosine_similarity(
        feature_a,
        feature_b,
    )

    # This is only a development threshold.
    #
    # We will calibrate it using multiple
    # genuine/impostor samples before deployment.

    matched = similarity >= 0.363

    return {
        "matched": matched,
        "similarity": round(
            similarity,
            4,
        ),
    }