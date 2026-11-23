from __future__ import annotations

from typing import Any

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    UploadFile,
)
from pydantic import BaseModel, Field

from sqlalchemy.orm import Session
from fastapi import Depends

from app.database.database import get_db
from app.database.models import Person

from services.face_service import (
    base64_to_image,
    extract_feature,
    feature_to_bytes,
)

from services.id_card_service import (
    parse_id_cards,
)


router = APIRouter(
    prefix="/api/enrollment",
    tags=["Enrollment"],
)


# ============================================================
# CONSTANTS
# ============================================================

MAX_FILE_SIZE = 20 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

ALLOWED_ROLES = {
    "student",
    "teacher",
    "staff",
}


# ============================================================
# HELPERS
# ============================================================

def clean_string(
    value: str | None,
) -> str | None:

    if value is None:
        return None

    value = value.strip()

    return value or None


def clean_role(
    value: str | None,
) -> str:

    if not value:
        return "student"

    role = value.strip().lower()

    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Role must be one of: "
                "student, teacher or staff."
            ),
        )

    return role


def clean_preview_data(
    card: dict[str, Any],
) -> dict[str, Any]:

    data = card.get(
        "data",
        {},
    )

    return {
        "page": card.get(
            "page"
        ),

        "success": bool(
            card.get(
                "success",
                False,
            )
        ),

        "full_name": data.get(
            "full_name"
        ),

        "enrollment_no": data.get(
            "enrollment_no"
        ),

        "role": data.get(
            "role",
            "student",
        ),

        "year": data.get(
            "year"
        ),

        "branch": data.get(
            "branch"
        ),

        "date_of_birth": data.get(
            "date_of_birth"
        ),

        "contact_number": data.get(
            "contact_number"
        ),

        "validity": data.get(
            "validity"
        ),

        "face_detected": bool(
            data.get(
                "face_detected",
                False,
            )
        ),

        "face_count": data.get(
            "face_count",
            0,
        ),

        "face_confidence": data.get(
            "face_confidence"
        ),

        "face_image": data.get(
            "face_image"
        ),

        "ocr_text": card.get(
            "ocr_text",
            "",
        ),
    }


def build_card_error(
    card: dict[str, Any],
) -> dict[str, Any]:

    return {
        "page": card.get(
            "page"
        ),
        "success": False,
        "error": card.get(
            "error",
            "Unknown processing error.",
        ),
    }


# ============================================================
# CONFIRM REQUEST
# ============================================================

class EnrollmentConfirmRequest(
    BaseModel
):
    """
    Data sent by the frontend after the
    administrator reviews the /preview result.
    """

    full_name: str = Field(
        ...,
        min_length=2,
        max_length=150,
    )

    enrollment_no: str | None = Field(
        default=None,
        max_length=100,
    )

    role: str = Field(
        default="student",
    )

    branch: str | None = Field(
        default=None,
        max_length=100,
    )

    year: str | None = Field(
        default=None,
        max_length=50,
    )

    date_of_birth: str | None = Field(
        default=None,
        max_length=50,
    )

    contact_number: str | None = Field(
        default=None,
        max_length=30,
    )

    validity: str | None = Field(
        default=None,
        max_length=100,
    )

    # Base64 image returned by /preview.
    #
    # Example:
    #
    # data:image/jpeg;base64,/9j/4AAQ...
    #
    face_image: str | None = None

    source_filename: str | None = Field(
        default=None,
        max_length=255,
    )


# ============================================================
# PREVIEW
# ============================================================

@router.post("/preview")
async def preview_enrollment(
    file: UploadFile = File(...),
):
    """
    Process an ID card/PDF without saving it.

    Pipeline:

        Upload
          ↓
        Validate file
          ↓
        OCR
          ↓
        Extract student information
          ↓
        YuNet face detection
          ↓
        Extract face image
          ↓
        Return preview

    Nothing is inserted into the database here.
    """

    # --------------------------------------------------------
    # Validate filename
    # --------------------------------------------------------

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No filename provided.",
        )

    filename = file.filename.strip()

    extension = ""

    if "." in filename:
        extension = (
            "."
            + filename.rsplit(
                ".",
                1,
            )[1].lower()
        )

    if extension not in ALLOWED_EXTENSIONS:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Allowed formats: PDF, JPG, "
                "JPEG, PNG and WEBP."
            ),
        )

    # --------------------------------------------------------
    # Read upload
    # --------------------------------------------------------

    try:

        file_bytes = await file.read()

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=(
                "Could not read uploaded file: "
                f"{exc}"
            ),
        )

    if not file_bytes:

        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    # --------------------------------------------------------
    # Size validation
    # --------------------------------------------------------

    if len(file_bytes) > MAX_FILE_SIZE:

        raise HTTPException(
            status_code=413,
            detail=(
                "File is larger than 20 MB."
            ),
        )

    # --------------------------------------------------------
    # Parse ID card
    # --------------------------------------------------------

    try:

        result = parse_id_cards(
            file_bytes=file_bytes,
            filename=filename,
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "ID card processing failed: "
                f"{exc}"
            ),
        )

    # --------------------------------------------------------
    # Extract cards
    # --------------------------------------------------------

    cards = result.get(
        "cards",
        [],
    )

    previews: list[
        dict[str, Any]
    ] = []

    for card in cards:

        if not card.get(
            "success",
            False,
        ):

            previews.append(
                build_card_error(
                    card
                )
            )

            continue

        previews.append(
            clean_preview_data(
                card
            )
        )

    # --------------------------------------------------------
    # Nothing processed
    # --------------------------------------------------------

    if not previews:

        raise HTTPException(
            status_code=422,
            detail=(
                "No ID card could be "
                "processed from this file."
            ),
        )

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return {
        "success": bool(
            result.get(
                "success",
                False,
            )
        ),

        "filename": filename,

        "total_pages": result.get(
            "total_pages",
            len(previews),
        ),

        "successful_pages": result.get(
            "successful_pages",
            0,
        ),

        "cards": previews,
    }


# ============================================================
# CONFIRM / SAVE
# ============================================================

@router.post("/confirm")
async def confirm_enrollment(
    request: EnrollmentConfirmRequest,
):
    """
    Save a reviewed enrollment.

    The frontend sends the corrected information
    from the preview screen.

    Pipeline:

        Reviewed data
             ↓
        Validate fields
             ↓
        Check duplicate enrollment
             ↓
        Decode face image
             ↓
        Generate SFace embedding
             ↓
        Save to SQLite
             ↓
        Return person ID
    """

    # --------------------------------------------------------
    # Clean fields
    # --------------------------------------------------------

    full_name = (
        request.full_name.strip()
    )

    if not full_name:

        raise HTTPException(
            status_code=400,
            detail="Full name is required.",
        )

    if len(full_name) < 2:

        raise HTTPException(
            status_code=400,
            detail=(
                "Full name must contain "
                "at least 2 characters."
            ),
        )

    enrollment_no = clean_string(
        request.enrollment_no
    )

    branch = clean_string(
        request.branch
    )

    year = clean_string(
        request.year
    )

    date_of_birth = clean_string(
        request.date_of_birth
    )

    contact_number = clean_string(
        request.contact_number
    )

    validity = clean_string(
        request.validity
    )

    source_filename = clean_string(
        request.source_filename
    )

    role = clean_role(
        request.role
    )

    # --------------------------------------------------------
    # Duplicate enrollment check
    # --------------------------------------------------------

    if enrollment_no:

        try:

            existing = (
                get_person_by_enrollment(
                    enrollment_no
                )
            )

        except Exception as exc:

            raise HTTPException(
                status_code=500,
                detail=(
                    "Could not check existing "
                    f"enrollment: {exc}"
                ),
            )

        if existing:

            raise HTTPException(
                status_code=409,
                detail={
                    "message": (
                        "Enrollment number "
                        "already exists."
                    ),
                    "enrollment_no": (
                        enrollment_no
                    ),
                    "person_id": existing.get(
                        "id"
                    ),
                    "full_name": existing.get(
                        "full_name"
                    ),
                },
            )

    # --------------------------------------------------------
    # Face embedding
    # --------------------------------------------------------

    embedding_bytes = None

    face_enrolled = False

    if request.face_image:

        try:

            # Base64 → OpenCV image
            face_image = (
                base64_to_image(
                    request.face_image
                )
            )

            # Generate SFace feature
            feature = extract_feature(
                face_image
            )

            # Serialize feature for SQLite
            embedding_bytes = (
                feature_to_bytes(
                    feature
                )
            )

            face_enrolled = True

        except Exception as exc:

            raise HTTPException(
                status_code=422,
                detail=(
                    "Face embedding failed: "
                    f"{exc}"
                ),
            )

    # --------------------------------------------------------
    # Save person
    # --------------------------------------------------------

    person_data = {
        "full_name": full_name,

        "enrollment_no": enrollment_no,

        "role": role,

        "branch": branch,

        "year": year,

        "date_of_birth": (
            date_of_birth
        ),

        "contact_number": (
            contact_number
        ),

        "validity": validity,

        "face_embedding": (
            embedding_bytes
        ),

        "face_image": (
            request.face_image
        ),

        "source_filename": (
            source_filename
        ),
    }

    try:

        person_id = create_person(
            person_data
        )

    except Exception as exc:

        message = str(exc)

        # SQLite duplicate protection.
        if (
            "UNIQUE constraint failed"
            in message
        ):

            raise HTTPException(
                status_code=409,
                detail=(
                    "Enrollment number "
                    "already exists."
                ),
            )

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not save enrollment: "
                f"{exc}"
            ),
        )

    # --------------------------------------------------------
    # Verify saved record
    # --------------------------------------------------------

    try:

        saved_person = get_person(
            person_id
        )

    except Exception:

        saved_person = None

    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return {
        "success": True,

        "message": (
            "Enrollment saved successfully."
        ),

        "person_id": person_id,

        "full_name": full_name,

        "enrollment_no": enrollment_no,

        "role": role,

        "branch": branch,

        "year": year,

        "date_of_birth": (
            date_of_birth
        ),

        "contact_number": (
            contact_number
        ),

        "validity": validity,

        "face_enrolled": (
            face_enrolled
        ),

        "source_filename": (
            source_filename
        ),

        "created_at": (
            saved_person.get(
                "created_at"
            )
            if saved_person
            else None
        ),
    }


# ============================================================
# LIST ENROLLED PEOPLE
# ============================================================

@router.get("/people")
async def get_enrolled_people():
    """
    Return all enrolled people.

    Face embeddings are intentionally NOT returned.
    """

    try:

        people = list_people()

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not load enrolled "
                f"people: {exc}"
            ),
        )

    return {
        "success": True,

        "count": len(people),

        "people": people,
    }


# ============================================================
# GET SINGLE ENROLLMENT
# ============================================================

@router.get("/people/{person_id}")
async def get_enrollment(
    person_id: int,
):
    """
    Return one enrollment.

    The face embedding is removed from
    the API response for security.
    """

    if person_id <= 0:

        raise HTTPException(
            status_code=400,
            detail="Invalid person ID.",
        )

    try:

        person = get_person(
            person_id
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not load person: "
                f"{exc}"
            ),
        )

    if person is None:

        raise HTTPException(
            status_code=404,
            detail="Person not found.",
        )

    # Never send the raw face embedding
    # through the API.
    person.pop(
        "face_embedding",
        None,
    )

    return {
        "success": True,
        "person": person,
    }