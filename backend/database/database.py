from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(
    r"C:\SmartCampusVision"
)

DATABASE_DIR = (
    PROJECT_ROOT
    / "data"
)

DATABASE_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

DATABASE_PATH = (
    DATABASE_DIR
    / "smart_campus.db"
)


def get_connection() -> sqlite3.Connection:

    connection = sqlite3.connect(
        DATABASE_PATH
    )

    connection.row_factory = (
        sqlite3.Row
    )

    return connection


def initialize_database() -> None:

    connection = get_connection()

    try:

        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS people (
                id INTEGER PRIMARY KEY AUTOINCREMENT,

                full_name TEXT NOT NULL,

                enrollment_no TEXT UNIQUE,

                role TEXT NOT NULL
                    DEFAULT 'student',

                branch TEXT,

                year TEXT,

                date_of_birth TEXT,

                contact_number TEXT,

                validity TEXT,

                face_embedding BLOB,

                face_image TEXT,

                source_filename TEXT,

                created_at TEXT
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TEXT
                    DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS
                idx_people_enrollment
            ON people(enrollment_no);

            CREATE INDEX IF NOT EXISTS
                idx_people_name
            ON people(full_name);

            CREATE INDEX IF NOT EXISTS
                idx_people_role
            ON people(role);
            """
        )

        connection.commit()

    finally:

        connection.close()


def create_person(
    data: dict[str, Any],
) -> int:

    connection = get_connection()

    try:

        cursor = connection.execute(
            """
            INSERT INTO people (
                full_name,
                enrollment_no,
                role,
                branch,
                year,
                date_of_birth,
                contact_number,
                validity,
                face_embedding,
                face_image,
                source_filename
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data.get("full_name"),
                data.get("enrollment_no"),
                data.get(
                    "role",
                    "student",
                ),
                data.get("branch"),
                data.get("year"),
                data.get(
                    "date_of_birth"
                ),
                data.get(
                    "contact_number"
                ),
                data.get("validity"),
                data.get(
                    "face_embedding"
                ),
                data.get("face_image"),
                data.get(
                    "source_filename"
                ),
            ),
        )

        connection.commit()

        return int(
            cursor.lastrowid
        )

    finally:

        connection.close()


def get_person(
    person_id: int,
) -> dict | None:

    connection = get_connection()

    try:

        row = connection.execute(
            """
            SELECT *
            FROM people
            WHERE id = ?
            """,
            (person_id,),
        ).fetchone()

        if row is None:
            return None

        return dict(row)

    finally:

        connection.close()


def get_person_by_enrollment(
    enrollment_no: str,
) -> dict | None:

    connection = get_connection()

    try:

        row = connection.execute(
            """
            SELECT *
            FROM people
            WHERE enrollment_no = ?
            """,
            (enrollment_no,),
        ).fetchone()

        if row is None:
            return None

        return dict(row)

    finally:

        connection.close()


def list_people() -> list[dict]:

    connection = get_connection()

    try:

        rows = connection.execute(
            """
            SELECT
                id,
                full_name,
                enrollment_no,
                role,
                branch,
                year,
                date_of_birth,
                contact_number,
                validity,
                source_filename,
                created_at
            FROM people
            ORDER BY full_name
            """
        ).fetchall()

        return [
            dict(row)
            for row in rows
        ]

    finally:

        connection.close()