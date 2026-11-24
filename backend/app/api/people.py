from pydantic import BaseModel

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


    face_embedding = None
    if person_data.face_image:
        try:
            from services.face_service import (
                base64_to_image,
                extract_face_embedding_from_image,
                feature_to_bytes,
            )
            img = base64_to_image(person_data.face_image)
            feature = extract_face_embedding_from_image(img)
            face_embedding = feature_to_bytes(feature)
        except Exception as exc:
            print(f"[PEOPLE] Embedding extraction error: {exc}")

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
            # Seamlessly update existing person record & face biometric
            existing.full_name = full_name
            existing.role = role
            if person_data.year:
                existing.year = person_data.year
            if person_data.branch:
                existing.branch = person_data.branch
            if person_data.date_of_birth:
                existing.date_of_birth = person_data.date_of_birth
            if person_data.contact_number:
                existing.contact_number = person_data.contact_number
            if person_data.validity:
                existing.validity = person_data.validity
            if person_data.face_image:
                existing.face_image = person_data.face_image
            if face_embedding is not None:
                if existing.face_embedding:
                    from services.face_service import bytes_to_features, bytes_to_feature, cosine_similarity
                    existing_feats = bytes_to_features(existing.face_embedding)
                    new_feat = bytes_to_feature(face_embedding)
                    if not any(cosine_similarity(new_feat, f) > 0.96 for f in existing_feats) and len(existing_feats) < 4:
                        existing.face_embedding = existing.face_embedding + face_embedding
                    else:
                        existing.face_embedding = face_embedding
                else:
                    existing.face_embedding = face_embedding
            db.commit()
            db.refresh(existing)
            return existing

    person = Person(
        full_name=full_name,
        role=role,
        enrollment_no=enrollment_no,
        year=person_data.year,
        branch=person_data.branch,
        date_of_birth=person_data.date_of_birth,
        contact_number=person_data.contact_number,
        validity=person_data.validity,
        face_embedding=face_embedding,
        face_image=person_data.face_image,
        source_filename=person_data.source_filename,
        consent_status=person_data.consent_status,
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


# ============================================================
# ADD FACE SAMPLE (MULTI-EMBEDDING / WEBCAM ENRICHMENT)
# ============================================================

class AddFaceSampleRequest(BaseModel):
    face_image: str


@router.post(
    "/{person_id}/add-sample",
)
def add_face_sample(
    person_id: int,
    payload: AddFaceSampleRequest,
    db: Session = Depends(get_db),
):
    person = (
        db.query(Person)
        .filter(Person.id == person_id)
        .first()
    )

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Person not found.",
        )

    try:
        from services.face_service import (
            base64_to_image,
            extract_face_embedding_from_image,
            feature_to_bytes,
            bytes_to_features,
            bytes_to_feature,
            cosine_similarity,
        )

        img = base64_to_image(payload.face_image)
        new_feat = extract_face_embedding_from_image(img)
        new_bytes = feature_to_bytes(new_feat)

        if person.face_embedding:
            existing_feats = bytes_to_features(person.face_embedding)
            # Add if sufficiently distinct (< 0.96) and under 5 samples max
            if not any(cosine_similarity(new_feat, f) > 0.96 for f in existing_feats) and len(existing_feats) < 5:
                person.face_embedding = person.face_embedding + new_bytes
        else:
            person.face_embedding = new_bytes

        db.commit()
        db.refresh(person)

        total_samples = len(bytes_to_features(person.face_embedding))
        return {
            "success": True,
            "person_id": person.id,
            "total_samples": total_samples,
            "message": f"Face sample registered. Total biometric samples: {total_samples}",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to process face sample: {exc}",
        )
