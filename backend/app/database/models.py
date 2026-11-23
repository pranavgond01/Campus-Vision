from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
)

from .database import Base


# ============================================================
# PERSON
# ============================================================

class Person(Base):

    __tablename__ = "people"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    full_name = Column(
        String(150),
        nullable=False,
        index=True,
    )

    role = Column(
        String(50),
        nullable=False,
        default="student",
    )

    enrollment_no = Column(
        String(100),
        unique=True,
        index=True,
        nullable=True,
    )

    year = Column(
        String(50),
        nullable=True,
    )

    branch = Column(
        String(100),
        nullable=True,
    )

    date_of_birth = Column(
        String(30),
        nullable=True,
    )

    contact_number = Column(
        String(30),
        nullable=True,
    )

    validity = Column(
        String(100),
        nullable=True,
    )

    face_embedding = Column(
        LargeBinary,
        nullable=True,
    )

    face_image = Column(
        String,
        nullable=True,
    )

    source_filename = Column(
        String,
        nullable=True,
    )

    consent_status = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


# ============================================================
# RECOGNITION EVENT
# ============================================================

class RecognitionEvent(Base):

    __tablename__ = "recognition_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    person_id = Column(
        Integer,
        ForeignKey("people.id"),
        nullable=True,
        index=True,
    )

    camera_id = Column(
        String(100),
        nullable=False,
        default="LOCAL-CAMERA-01",
    )

    confidence = Column(
        Float,
        nullable=False,
    )

    status = Column(
        String(30),
        nullable=False,
    )

    timestamp = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )