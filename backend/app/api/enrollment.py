from __future__ import annotations

from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)

from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

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
# HELPERS
# ============================================================

def clean_preview_data(
    card: dict[str, Any],
) -> dict[str, Any]:

    data = card.get(
        "data",
        {},
    )

    return {
        "page": card.get("page"),

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

        "face_detected": data.get(
            "face_detected",
            False,
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


def validate_upload(
    file: UploadFile,
) -> None:

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No filename provided.",
        )

    allowed_extensions = {
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }

    filename = file.filename.lower()

    if not any(
        filename.endswith(extension)
        for extension in allowed_extensions
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Use PDF, JPG, JPEG, PNG or WEBP."
            ),
        )


# ============================================================
# PREVIEW
# ============================================================

@router.post("/preview")
async def preview_enrollment(
    file: UploadFile = File(...),
):

    validate_upload(file)

    file_bytes = await file.read()

    if not file_bytes:

        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    # 20 MB development limit.
    if len(file_bytes) > 20 * 1024 * 1024:

        raise HTTPException(
            status_code=413,
            detail="File is larger than 20 MB.",
        )

    try:

        result = parse_id_cards(
            file_bytes=file_bytes,
            filename=file.filename,
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=(
                "ID card processing failed: "
                f"{exc}"
            ),
        )

    previews = []

    for card in result.get(
        "cards",
        [],
    ):

        if not card.get("success"):

            previews.append(
                {
                    "page": card.get("page"),
                    "success": False,
                    "error": card.get(
                        "error",
                        "Unknown error",
                    ),
                }
            )

            continue

        preview = clean_preview_data(
            card
        )

        preview["success"] = True

        previews.append(preview)

    return {
        "success": result.get(
            "success",
            False,
        ),

        "filename": file.filename,

        "total_pages": result.get(
            "total_pages",
            0,
        ),

        "successful_pages": result.get(
            "successful_pages",
            0,
        ),

        "cards": previews,
    }


# ============================================================
# CONFIRM REQUEST
# ============================================================

class EnrollmentConfirmRequest(BaseModel):

    full_name: str = Field(
        ...,
        min_length=2,
        max_length=150,
    )

    enrollment_no: str | None = None

    role: str = "student"

    branch: str | None = None

    year: str | None = None

    date_of_birth: str | None = None

    contact_number: str | None = None

    validity: str | None = None

    face_image: str | None = None

    source_filename: str | None = None

    consent_status: bool = True


# ============================================================
# CONFIRM
# ============================================================

@router.post("/confirm")
def confirm_enrollment(
    request: EnrollmentConfirmRequest,
    db: Session = Depends(get_db),
):

    # --------------------------------------------------------
    # BASIC VALIDATION
    # --------------------------------------------------------

    full_name = request.full_name.strip()

    if not full_name:

        raise HTTPException(
            status_code=400,
            detail="Full name is required.",
        )

    role = (
        request.role
        .lower()
        .strip()
    )

    if role not in {
        "student",
        "teacher",
        "staff",
    }:

        raise HTTPException(
            status_code=400,
            detail=(
                "Role must be student, "
                "teacher or staff."
            ),
        )

    enrollment_no = (
        request.enrollment_no.strip()
        if request.enrollment_no
        else None
    )

    # --------------------------------------------------------
    # DUPLICATE CHECK
    # --------------------------------------------------------

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

            raise HTTPException(
                status_code=409,
                detail=(
                    "An enrollment with this "
                    "enrollment number already exists."
                ),
            )

    # --------------------------------------------------------
    # FACE EMBEDDING
    # --------------------------------------------------------

    embedding_bytes = None

    if request.face_image:

        try:

            from services.face_service import extract_face_embedding_from_image

            face_image = base64_to_image(
                request.face_image
            )

            feature = extract_face_embedding_from_image(
                face_image
            )

            embedding_bytes = (
                feature_to_bytes(
                    feature
                )
            )

        except Exception as exc:

            raise HTTPException(
                status_code=422,
                detail=(
                    "Face embedding failed: "
                    f"{exc}"
                ),
            )

    # --------------------------------------------------------
    # SAVE PERSON
    # --------------------------------------------------------

    person = Person(
        full_name=full_name,

        enrollment_no=enrollment_no,

        role=role,

        branch=request.branch,

        year=request.year,

        date_of_birth=(
            request.date_of_birth
        ),

        contact_number=(
            request.contact_number
        ),

        validity=request.validity,

        face_embedding=embedding_bytes,

        face_image=request.face_image,

        source_filename=(
            request.source_filename
        ),

        consent_status=(
            request.consent_status
        ),
    )

    try:

        db.add(person)

        db.commit()

        db.refresh(person)

    except IntegrityError:

        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "An enrollment with this "
                "enrollment number already exists."
            ),
        )

    except Exception as exc:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Could not save enrollment: "
                f"{exc}"
            ),
        )

    return {
        "success": True,

        "message": (
            "Enrollment saved successfully."
        ),

        "person_id": person.id,

        "full_name": person.full_name,

        "enrollment_no": (
            person.enrollment_no
        ),

        "role": person.role,

        "face_enrolled": (
            embedding_bytes is not None
        ),

        "consent_status": (
            person.consent_status
        ),
    }


# ============================================================
# LIST ENROLLED PEOPLE
# ============================================================

@router.get("/people")
def get_enrolled_people(
    db: Session = Depends(get_db),
):

    people = (
        db.query(Person)
        .order_by(
            Person.created_at.desc()
        )
        .all()
    )

    return {
        "success": True,

        "count": len(people),

        "people": [
            {
                "id": person.id,

                "full_name": (
                    person.full_name
                ),

                "enrollment_no": (
                    person.enrollment_no
                ),

                "role": person.role,

                "branch": person.branch,

                "year": person.year,

                "date_of_birth": (
                    person.date_of_birth
                ),

                "contact_number": (
                    person.contact_number
                ),

                "validity": (
                    person.validity
                ),

                "face_enrolled": (
                    person.face_embedding
                    is not None
                ),

                "consent_status": (
                    person.consent_status
                ),

                "source_filename": (
                    person.source_filename
                ),

                "created_at": (
                    person.created_at
                ),
            }
            for person in people
        ],
    }


# ============================================================
# GET SINGLE ENROLLMENT
# ============================================================

@router.get("/people/{person_id}")
def get_enrollment(
    person_id: int,
    db: Session = Depends(get_db),
):

    person = (
        db.query(Person)
        .filter(
            Person.id == person_id
        )
        .first()
    )

    if not person:

        raise HTTPException(
            status_code=404,
            detail="Enrollment not found.",
        )

    return {
        "success": True,

        "person": {
            "id": person.id,

            "full_name": person.full_name,

            "enrollment_no": (
                person.enrollment_no
            ),

            "role": person.role,

            "branch": person.branch,

            "year": person.year,

            "date_of_birth": (
                person.date_of_birth
            ),

            "contact_number": (
                person.contact_number
            ),

            "validity": person.validity,

            "face_enrolled": (
                person.face_embedding
                is not None
            ),

            "consent_status": (
                person.consent_status
            ),

            "source_filename": (
                person.source_filename
            ),

            "created_at": person.created_at,
        },
    }


# ============================================================
# DELETE ENROLLMENT
# ============================================================

@router.delete("/people/{person_id}")
def delete_enrollment(
    person_id: int,
    db: Session = Depends(get_db),
):

    person = (
        db.query(Person)
        .filter(
            Person.id == person_id
        )
        .first()
    )

    if not person:

        raise HTTPException(
            status_code=404,
            detail="Enrollment not found.",
        )

    db.delete(person)

    db.commit()

    return {
        "success": True,

        "message": (
            "Enrollment deleted successfully."
        ),

        "person_id": person_id,
    }