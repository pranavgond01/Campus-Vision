from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from app.database.database import get_db

from app.database.models import (
    Person,
    RecognitionEvent,
)


router = APIRouter(
    prefix="/api/statistics",
    tags=["Statistics"],
)


# ============================================================
# STATISTICS
# ============================================================

@router.get("")
def get_statistics(
    db: Session = Depends(get_db),
):

    total_people = (
        db.query(Person)
        .count()
    )

    total_students = (
        db.query(Person)
        .filter(
            Person.role == "student"
        )
        .count()
    )

    total_teachers = (
        db.query(Person)
        .filter(
            Person.role == "teacher"
        )
        .count()
    )

    today = datetime.utcnow().date()

    tomorrow = (
        today + timedelta(days=1)
    )

    start_of_day = datetime.combine(
        today,
        datetime.min.time(),
    )

    end_of_day = datetime.combine(
        tomorrow,
        datetime.min.time(),
    )

    events_today = (
        db.query(RecognitionEvent)
        .filter(
            RecognitionEvent.timestamp
            >= start_of_day,
            RecognitionEvent.timestamp
            < end_of_day,
        )
        .count()
    )

    recognized_today = (
        db.query(RecognitionEvent)
        .filter(
            RecognitionEvent.timestamp
            >= start_of_day,
            RecognitionEvent.timestamp
            < end_of_day,
            RecognitionEvent.status
            == "recognized",
        )
        .count()
    )

    unknown_today = (
        db.query(RecognitionEvent)
        .filter(
            RecognitionEvent.timestamp
            >= start_of_day,
            RecognitionEvent.timestamp
            < end_of_day,
            RecognitionEvent.status
            == "unknown",
        )
        .count()
    )

    return {
        "success": True,

        "total_people": total_people,

        "total_students": total_students,

        "total_teachers": total_teachers,

        "events_today": events_today,

        "recognized_today": recognized_today,

        "unknown_today": unknown_today,
    }