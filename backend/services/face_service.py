from __future__ import annotations

import base64
import os
from pathlib import Path

import cv2
import numpy as np


BACKEND_DIR = Path(__file__).resolve().parent.parent

SFACE_PATH = (
    BACKEND_DIR
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


def extract_face_embedding_from_image(img: np.ndarray) -> np.ndarray:
    """
    Detects the primary face in the image, aligns it with YuNet's 5 facial landmarks,
    and returns its normalized SFace embedding vector.
    Falls back to bounding-box crop or direct extraction if alignment fails.
    """
    if img is None:
        raise ValueError("Image is empty.")

    try:
        from app.api.recognition import detect_faces, crop_face
        faces = detect_faces(img)
        if faces:
            # Pick largest detected face
            largest = max(faces, key=lambda f: f["width"] * f["height"])
            if "raw_face" in largest and FACE_RECOGNIZER is not None:
                try:
                    aligned = FACE_RECOGNIZER.alignCrop(img, largest["raw_face"])
                    if aligned is not None and aligned.size > 0:
                        return extract_feature(aligned)
                except Exception as align_err:
                    print(f"[FACE_SERVICE] alignCrop error, fallback to crop: {align_err}")

            face_crop = crop_face(img, largest)
            if face_crop is not None and face_crop.size > 0:
                return extract_feature(face_crop)
    except Exception as exc:
        print(f"[FACE_SERVICE] Face detection during enrollment fallback: {exc}")

    return extract_feature(img)


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
    value: bytes | str,
) -> np.ndarray:
    if isinstance(value, str):
        try:
            import json
            vals = json.loads(value)
            return np.asarray(vals, dtype=np.float32).reshape(-1)
        except Exception:
            value = value.encode("utf-8")
    elif isinstance(value, bytes):
        try:
            stripped = value.strip()
            if stripped.startswith(b"[") and stripped.endswith(b"]"):
                import json
                vals = json.loads(stripped.decode("utf-8"))
                return np.asarray(vals, dtype=np.float32).reshape(-1)
        except Exception:
            pass

    return np.frombuffer(
        value,
        dtype=np.float32,
    )


def bytes_to_features(
    value: bytes | str,
) -> list[np.ndarray]:
    """
    Returns list of 128-d normalized embeddings stored for a person.
    Supports single or multiple stored embeddings (e.g. ID card + live webcam snapshots).
    """
    flat = bytes_to_feature(value)
    if flat.size == 0:
        return []
    if flat.size % 128 != 0:
        norm = np.linalg.norm(flat)
        return [flat / norm] if norm > 0 else []

    count = flat.size // 128
    matrix = flat.reshape((count, 128))
    results = []
    for i in range(count):
        row = matrix[i]
        norm = np.linalg.norm(row)
        if norm > 0:
            results.append(row / norm)
    return results


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