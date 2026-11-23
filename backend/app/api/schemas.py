from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


# ============================================================
# PEOPLE
# ============================================================

class PersonCreate(BaseModel):
    full_name: str = Field(
        ...,
        min_length=2,
        max_length=150,
    )

    role: str = Field(
        default="student",
        max_length=50,
    )

    enrollment_no: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    year: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    branch: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    contact_number: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    consent_status: bool = False


class PersonResponse(BaseModel):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    full_name: str

    role: str

    enrollment_no: Optional[str] = None

    year: Optional[str] = None

    branch: Optional[str] = None

    contact_number: Optional[str] = None

    face_embedding: Optional[str] = None

    consent_status: bool

    created_at: datetime


# ============================================================
# RECOGNITION REQUEST
# ============================================================

class RecognitionRequest(BaseModel):

    image: str = Field(
        ...,
        min_length=10,
        description=(
            "Base64 encoded camera image. "
            "Can include a data:image/... prefix."
        ),
    )

    camera_id: Optional[str] = Field(
        default="LOCAL-CAMERA-01",
        max_length=100,
    )


# ============================================================
# RECOGNITION MATCH
# ============================================================

class RecognitionMatch(BaseModel):

    person_id: int

    full_name: str

    enrollment_no: Optional[str] = None

    role: str

    branch: Optional[str] = None

    year: Optional[str] = None

    confidence: float

    matched: bool


# ============================================================
# RECOGNITION RESPONSE
# ============================================================

class RecognitionResponse(BaseModel):

    success: bool

    detected: bool

    matched: bool

    message: str

    confidence: Optional[float] = None

    person: Optional[RecognitionMatch] = None

    face_count: int = 0

    camera_id: str


# ============================================================
# CAMERA
# ============================================================

class CameraResponse(BaseModel):

    camera_id: str

    name: Optional[str] = None

    status: str

    width: Optional[int] = None

    height: Optional[int] = None

    fps: Optional[int] = None


# ============================================================
# RECOGNITION EVENT
# ============================================================

class RecognitionEventResponse(BaseModel):

    model_config = ConfigDict(
        from_attributes=True
    )

    id: int

    person_id: Optional[int] = None

    camera_id: str

    confidence: float

    status: str

    timestamp: datetime


# ============================================================
# STATISTICS
# ============================================================

class StatisticsResponse(BaseModel):

    total_people: int

    total_students: int

    total_teachers: int

    total_recognition_events: int

    recognized_events: int

    unknown_events: int

    recognition_rate: float