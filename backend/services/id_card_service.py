from __future__ import annotations

import base64
import io
import os
import re
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import pymupdf
import pytesseract

from PIL import Image


# ============================================================
# CONFIGURATION
# ============================================================

TESSERACT_PATH = Path(
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

if not TESSERACT_PATH.is_file():
    raise RuntimeError(
        "Tesseract OCR was not found at:\n"
        f"{TESSERACT_PATH}\n\n"
        "Install Tesseract 5.x or update TESSERACT_PATH."
    )

pytesseract.pytesseract.tesseract_cmd = str(
    TESSERACT_PATH
)


# YuNet model.
#
# Put the model here:
#
# C:\SmartCampusVision\models\face_detection_yunet_2023mar.onnx
#
# If your existing model is somewhere else, change this path.
YUNET_PATH = Path(
    r"C:\SmartCampusVision\backend\models\yunet\face_detection_yunet_2023mar.onnx"
)


# ============================================================
# OCR CONFIGURATION
# ============================================================

OCR_CONFIG = (
    "--oem 3 "
    "--psm 6"
)


# ============================================================
# UTILITY FUNCTIONS
# ============================================================

def clean_text(value: str | None) -> str | None:
    """
    Normalize OCR text.
    """

    if not value:
        return None

    value = value.replace("\x0c", " ")
    value = value.replace("\r", "\n")

    lines = []

    for line in value.splitlines():
        line = re.sub(r"[ \t]+", " ", line)
        line = line.strip()

        if line:
            lines.append(line)

    if not lines:
        return None

    return "\n".join(lines)


def normalize_spaces(value: str | None) -> str | None:
    if not value:
        return None

    value = re.sub(r"\s+", " ", value)
    return value.strip()


def clean_phone(value: str | None) -> str | None:
    """
    Extract a 10-digit Indian phone number.
    """

    if not value:
        return None

    digits = re.sub(r"\D", "", value)

    # Sometimes OCR captures +91.
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]

    if len(digits) == 10:
        return digits

    match = re.search(r"[6-9]\d{9}", digits)

    if match:
        return match.group(0)

    return None


def clean_enrollment(value: str | None) -> str | None:
    """
    Normalize an enrollment / ID number.

    Example:
        PBE23054
    """

    if not value:
        return None

    value = value.upper()

    value = re.sub(
        r"[^A-Z0-9]",
        "",
        value,
    )

    if len(value) < 4:
        return None

    return value


def clean_date(value: str | None) -> str | None:
    """
    Normalize common date formats.
    """

    if not value:
        return None

    match = re.search(
        r"\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b",
        value,
    )

    if not match:
        return None

    day = match.group(1).zfill(2)
    month = match.group(2).zfill(2)
    year = match.group(3)

    if len(year) == 2:
        year = "20" + year

    return f"{day}-{month}-{year}"


# ============================================================
# IMAGE CONVERSION
# ============================================================

def bytes_to_image(data: bytes) -> np.ndarray:
    """
    Convert image bytes to OpenCV BGR image.
    """

    image = Image.open(io.BytesIO(data))

    image = image.convert("RGB")

    array = np.array(image)

    return cv2.cvtColor(
        array,
        cv2.COLOR_RGB2BGR,
    )


def pixmap_to_image(
    pixmap: pymupdf.Pixmap,
) -> np.ndarray:
    """
    Convert PyMuPDF pixmap to OpenCV image.
    """

    image = np.frombuffer(
        pixmap.samples,
        dtype=np.uint8,
    )

    channels = pixmap.n

    image = image.reshape(
        pixmap.height,
        pixmap.width,
        channels,
    )

    if channels == 4:
        return cv2.cvtColor(
            image,
            cv2.COLOR_RGBA2BGR,
        )

    return cv2.cvtColor(
        image,
        cv2.COLOR_RGB2BGR,
    )


# ============================================================
# IMAGE PREPROCESSING
# ============================================================

def upscale_image(
    image: np.ndarray,
    scale: float = 2.0,
) -> np.ndarray:

    height, width = image.shape[:2]

    return cv2.resize(
        image,
        (
            int(width * scale),
            int(height * scale),
        ),
        interpolation=cv2.INTER_CUBIC,
    )


def preprocess_for_ocr(
    image: np.ndarray,
) -> np.ndarray:
    """
    Improve ID-card text for OCR.
    """

    image = upscale_image(
        image,
        scale=2.0,
    )

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )

    # Mild denoise.
    gray = cv2.GaussianBlur(
        gray,
        (3, 3),
        0,
    )

    # Adaptive threshold works better
    # when the card has uneven lighting.
    threshold = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11,
    )

    return threshold


# ============================================================
# OCR
# ============================================================

def run_ocr(
    image: np.ndarray,
) -> str:

    processed = preprocess_for_ocr(
        image
    )

    text = pytesseract.image_to_string(
        processed,
        config=OCR_CONFIG,
    )

    return clean_text(text) or ""


# ============================================================
# FIELD EXTRACTION
# ============================================================

def find_line_after_label(
    lines: list[str],
    labels: list[str],
) -> str | None:

    for index, line in enumerate(lines):

        normalized = line.lower()

        for label in labels:

            if label.lower() in normalized:

                # Text after colon.
                if ":" in line:
                    value = line.split(
                        ":",
                        1,
                    )[1].strip()

                    if value:
                        return value

                # Otherwise use next line.
                if index + 1 < len(lines):
                    next_line = (
                        lines[index + 1]
                        .strip()
                    )

                    if next_line:
                        return next_line

    return None


def extract_name(
    lines: list[str],
) -> str | None:

    # Your card has the name in a prominent
    # line, so check lines containing common
    # name markers first.

    for line in lines:

        upper = line.upper()

        if "MR." in upper:
            cleaned = re.sub(
                r"^(MR\.?|MS\.?|MRS\.?|MISS\.?)\s*",
                "",
                line,
                flags=re.IGNORECASE,
            )

            cleaned = normalize_spaces(
                cleaned
            )

            if cleaned and len(cleaned) >= 3:
                return cleaned

    # Fallback:
    # Find a mostly alphabetic uppercase line.

    candidates = []

    for line in lines:

        cleaned = normalize_spaces(line)

        if not cleaned:
            continue

        if len(cleaned) < 5:
            continue

        letters = sum(
            char.isalpha()
            for char in cleaned
        )

        digits = sum(
            char.isdigit()
            for char in cleaned
        )

        if letters >= 5 and digits <= 2:
            candidates.append(cleaned)

    if candidates:
        # Avoid college header.
        blacklist = [
            "INSTITUTE",
            "TECHNOLOGY",
            "MANAGEMENT",
            "SOCIETY",
            "VISION",
        ]

        for candidate in candidates:

            upper = candidate.upper()

            if not any(
                word in upper
                for word in blacklist
            ):
                return candidate

    return None


def extract_enrollment(
    text: str,
) -> str | None:

    # Look around ID/Enrollment labels.
    patterns = [
        r"(?:ID\s*NO|ID\s*NUMBER|ENROLLMENT\s*NO|ENROLMENT\s*NO|ROLL\s*NO)"
        r"\s*[:\-]?\s*([A-Z]{1,6}\s*\d{3,12})",

        r"\b([A-Z]{2,6}\d{4,12})\b",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if match:

            value = match.group(1)

            value = re.sub(
                r"\s+",
                "",
                value,
            )

            return clean_enrollment(
                value
            )

    return None


def extract_phone(
    text: str,
) -> str | None:

    # Prefer numbers close to Phone label.

    match = re.search(
        r"(?:PHONE|MOBILE|CONTACT|TEL)"
        r"\s*[:\-]?\s*(?:\+91[\s\-]?)?"
        r"([6-9][0-9\s\-]{8,14})",
        text,
        flags=re.IGNORECASE,
    )

    if match:
        return clean_phone(
            match.group(1)
        )

    # General fallback.
    matches = re.findall(
        r"(?<!\d)[6-9]\d{9}(?!\d)",
        text,
    )

    if matches:
        return matches[0]

    return None


def extract_dob(
    text: str,
) -> str | None:

    match = re.search(
        r"(?:D\.?O\.?B\.?|DATE\s+OF\s+BIRTH)"
        r"\s*[:\-]?\s*"
        r"(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})",
        text,
        flags=re.IGNORECASE,
    )

    if match:
        return clean_date(
            match.group(1)
        )

    # Fallback.
    match = re.search(
        r"\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b",
        text,
    )

    if match:
        return clean_date(
            match.group(0)
        )

    return None


def extract_branch(
    text: str,
) -> str | None:

    patterns = [
        r"BRANCH\s*[:\-]?\s*(.+)",
        r"DEPARTMENT\s*[:\-]?\s*(.+)",
        r"COURSE\s*[:\-]?\s*(.+)",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if match:

            value = normalize_spaces(
                match.group(1)
            )

            if value:
                return value

    return None


def extract_year(
    text: str,
) -> str | None:

    patterns = [
        r"\b(FIRST|SECOND|THIRD|FOURTH)\s+YEAR\b",
        r"\b(1ST|2ND|3RD|4TH)\s+YEAR\b",
        r"\bYEAR\s*[:\-]?\s*(\d)\b",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE,
        )

        if match:

            value = normalize_spaces(
                match.group(0)
            )

            return value

    return None


def extract_validity(
    text: str,
) -> str | None:

    match = re.search(
        r"VALIDITY\s*[:\-]?\s*(.+)",
        text,
        flags=re.IGNORECASE,
    )

    if match:
        return normalize_spaces(
            match.group(1)
        )

    return None


def detect_role(
    text: str,
) -> str:

    upper = text.upper()

    teacher_words = [
        "PROFESSOR",
        "LECTURER",
        "FACULTY",
        "TEACHER",
        "STAFF",
        "ASSISTANT PROFESSOR",
    ]

    if any(
        word in upper
        for word in teacher_words
    ):
        return "teacher"

    return "student"


# ============================================================
# FACE DETECTION
# ============================================================

def load_yunet():

    if not YUNET_PATH.is_file():
        print(
            "WARNING: YuNet model not found:"
        )
        print(YUNET_PATH)
        return None

    try:

        detector = cv2.FaceDetectorYN.create(
            str(YUNET_PATH),
            "",
            (320, 320),
            0.6,
            0.3,
            5000,
        )
        print(f"YUNET MODEL: {YUNET_PATH}")
        print("YUNET LOAD: OK")

        return detector

    except Exception as exc:

        print(
            "WARNING: Could not load YuNet:"
        )
        print(exc)

        return None


FACE_DETECTOR = load_yunet()


def detect_faces(
    image: np.ndarray,
) -> list[dict[str, Any]]:

    if FACE_DETECTOR is None:
        return []

    height, width = image.shape[:2]

    FACE_DETECTOR.setInputSize(
        (width, height)
    )

    try:

        _, faces = FACE_DETECTOR.detect(
            image
        )

    except Exception as exc:

        print(
            "YuNet detection error:",
            exc,
        )

        return []

    if faces is None:
        return []

    results = []

    for face in faces:

        x, y, w, h = face[:4]

        x = max(0, int(x))
        y = max(0, int(y))
        w = int(w)
        h = int(h)

        results.append(
            {
                "x": x,
                "y": y,
                "width": w,
                "height": h,
                "confidence": round(
                    float(face[-1]),
                    4,
                ),
            }
        )

    return results


# ============================================================
# FACE IMAGE EXTRACTION
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

    crop = image[
        y1:y2,
        x1:x2,
    ]

    if crop.size == 0:
        return None

    return crop


def image_to_base64(
    image: np.ndarray,
) -> str | None:

    try:

        success, encoded = cv2.imencode(
            ".jpg",
            image,
            [
                int(
                    cv2.IMWRITE_JPEG_QUALITY
                ),
                90,
            ],
        )

        if not success:
            return None

        encoded_bytes = encoded.tobytes()

        return (
            "data:image/jpeg;base64,"
            + base64.b64encode(
                encoded_bytes
            ).decode("utf-8")
        )

    except Exception:
        return None


# ============================================================
# SINGLE CARD PROCESSING
# ============================================================

def process_card_image(
    image: np.ndarray,
    page_number: int = 1,
) -> dict[str, Any]:

    # --------------------------------------------------------
    # OCR
    # --------------------------------------------------------

    raw_text = run_ocr(
        image
    )

    lines = [
        line.strip()
        for line in raw_text.splitlines()
        if line.strip()
    ]

    # --------------------------------------------------------
    # Extract fields
    # --------------------------------------------------------

    full_name = extract_name(
        lines
    )

    enrollment_no = extract_enrollment(
        raw_text
    )

    branch = extract_branch(
        raw_text
    )

    year = extract_year(
        raw_text
    )

    date_of_birth = extract_dob(
        raw_text
    )

    contact_number = extract_phone(
        raw_text
    )

    validity = extract_validity(
        raw_text
    )

    role = detect_role(
        raw_text
    )

    # --------------------------------------------------------
    # Face detection
    # --------------------------------------------------------

    faces = detect_faces(
        image
    )

    face_image = None

    if faces:

        # Largest face is normally
        # the ID-card portrait.

        largest_face = max(
            faces,
            key=lambda face:
            face["width"]
            * face["height"],
        )

        cropped = crop_face(
            image,
            largest_face,
        )

        if cropped is not None:
            face_image = image_to_base64(
                cropped
            )

    # --------------------------------------------------------
    # Result
    # --------------------------------------------------------

    return {
        "success": True,
        "page": page_number,

        "data": {
            "full_name": full_name,
            "enrollment_no": enrollment_no,
            "role": role,
            "year": year,
            "branch": branch,
            "date_of_birth": date_of_birth,
            "contact_number": contact_number,
            "validity": validity,

            "face_detected": len(faces) > 0,

            "face_count": len(faces),

            "face_confidence": (
                max(
                    face["confidence"]
                    for face in faces
                )
                if faces
                else None
            ),

            "face_image": face_image,
        },

        # Keep OCR visible during development.
        # Later we can hide this from production API.
        "ocr_text": raw_text,
    }


# ============================================================
# PDF / IMAGE IMPORT
# ============================================================

def parse_id_cards(
    file_bytes: bytes,
    filename: str | None = None,
) -> dict[str, Any]:

    filename = filename or ""

    extension = (
        Path(filename)
        .suffix
        .lower()
    )

    cards = []

    # --------------------------------------------------------
    # PDF
    # --------------------------------------------------------

    if extension == ".pdf":

        document = pymupdf.open(
            stream=file_bytes,
            filetype="pdf",
        )

        try:

            total_pages = len(
                document
            )

            for index in range(
                total_pages
            ):

                page = document[index]

                # High resolution rendering.
                pixmap = page.get_pixmap(
                    matrix=pymupdf.Matrix(
                        2.5,
                        2.5,
                    ),
                    alpha=False,
                )

                image = pixmap_to_image(
                    pixmap
                )

                try:

                    result = process_card_image(
                        image,
                        page_number=index + 1,
                    )

                    cards.append(
                        result
                    )

                except Exception as exc:

                    cards.append(
                        {
                            "success": False,
                            "page": index + 1,
                            "error": str(exc),
                        }
                    )

        finally:

            document.close()

        successful = sum(
            1
            for card in cards
            if card.get("success")
        )

        return {
            "filename": filename,
            "success": successful > 0,
            "total_pages": len(cards),
            "successful_pages": successful,
            "cards": cards,
        }

    # --------------------------------------------------------
    # Image
    # --------------------------------------------------------

    try:

        image = bytes_to_image(
            file_bytes
        )

        result = process_card_image(
            image,
            page_number=1,
        )

        return {
            "filename": filename,
            "success": True,
            "total_pages": 1,
            "successful_pages": 1,
            "cards": [
                result
            ],
        }

    except Exception as exc:

        return {
            "filename": filename,
            "success": False,
            "total_pages": 1,
            "successful_pages": 0,
            "cards": [
                {
                    "success": False,
                    "page": 1,
                    "error": str(exc),
                }
            ],
        }