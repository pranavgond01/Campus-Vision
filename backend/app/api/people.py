from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy.orm import Session

from app.database.database import get_db
from app.database.models import Person

from .schemas import (
    PersonCreate,
    PersonResponse,
)


router = APIRouter(
    prefix="/api/people",
    tags=["People"],
)


# ============================================================
# CREATE PERSON
# ============================================================

@router.post(
    "",
    response_model=PersonResponse,
)
def create_person(
    person_data: PersonCreate,
    db: Session = Depends(get_db),
):

    full_name = person_data.full_name.strip()

    if not full_name:

        raise HTTPException(
            status_code=400,
            detail="Full name is required.",
        )


    role = (
        person_data.role
        .strip()
        .lower()
    )


    if role not in (
        "student",
        "teacher",
        "staff",
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Role must be "
                "'student', 'teacher' "
                "or 'staff'."
            ),
        )


    enrollment_no = (
        person_data.enrollment_no.strip()
        if person_data.enrollment_no
        else None
    )


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
                    "Enrollment number "
                    "already exists."
                ),
            )


    person = Person(

        full_name=full_name,

        role=role,

        enrollment_no=enrollment_no,

        year=person_data.year,

        branch=person_data.branch,

        date_of_birth=(
            person_data.date_of_birth
        ),

        contact_number=(
            person_data.contact_number
        ),

        validity=(
            person_data.validity
        ),

        face_image=(
            person_data.face_image
        ),

        source_filename=(
            person_data.source_filename
        ),

        consent_status=(
            person_data.consent_status
        ),
    )


    db.add(person)

    db.commit()

    db.refresh(person)


    return person


# ============================================================
# LIST PEOPLE
# ============================================================

@router.get(
    "",
    response_model=list[PersonResponse],
)
def get_people(
    db: Session = Depends(get_db),
):

    return (
        db.query(Person)
        .order_by(
            Person.created_at.desc()
        )
        .all()
    )


# ============================================================
# GET PERSON
# ============================================================

@router.get(
    "/{person_id}",
    response_model=PersonResponse,
)
def get_person(
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
            detail="Person not found.",
        )


    return person


# ============================================================
# DELETE PERSON
# ============================================================

@router.delete(
    "/{person_id}"
)
def delete_person(
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
            detail="Person not found.",
        )


    db.delete(person)

    db.commit()


    return {
        "success": True,
        "message": (
            "Person deleted successfully."
        ),
    }