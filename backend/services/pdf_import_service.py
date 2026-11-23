from __future__ import annotations

import io
import re
from typing import Any

from pypdf import PdfReader


FIELD_ALIASES = {
    "full_name": [
        "full name",
        "name",
        "student name",
        "teacher name",
        "faculty name",
    ],
    "role": [
        "role",
        "type",
        "category",
        "designation",
    ],
    "enrollment_no": [
        "enrollment no",
        "enrollment number",
        "enrollment",
        "roll no",
        "roll number",
        "student id",
        "employee id",
        "faculty id",
        "id",
    ],
    "year": [
        "year",
        "academic year",
        "study year",
        "class year",
    ],
    "branch": [
        "branch",
        "department",
        "dept",
        "course",
    ],
    "contact_number": [
        "contact",
        "contact number",
        "mobile",
        "mobile number",
        "phone",
        "phone number",
    ],
}


def normalize_text(value: str) -> str:
    value = value.strip()
    value = re.sub(r"\s+", " ", value)
    return value


def normalize_header(value: str) -> str:
    value = normalize_text(value).lower()

    value = value.replace("_", " ")
    value = value.replace("-", " ")

    return value


def detect_field(header: str) -> str | None:
    normalized = normalize_header(header)

    for field, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if normalized == alias:
                return field

    return None


def normalize_role(value: str | None) -> str:
    if not value:
        return "student"

    text = value.strip().lower()

    teacher_values = {
        "teacher",
        "faculty",
        "professor",
        "prof",
        "lecturer",
        "staff",
        "teaching staff",
    }

    if text in teacher_values:
        return "teacher"

    return "student"


def clean_phone(value: str | None) -> str | None:
    if not value:
        return None

    value = normalize_text(value)

    return value if value else None


def clean_value(value: Any) -> str | None:
    if value is None:
        return None

    value = normalize_text(str(value))

    if not value:
        return None

    return value


def extract_pdf_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))

    pages: list[str] = []

    for page in reader.pages:
        text = page.extract_text() or ""

        if text.strip():
            pages.append(text)

    return "\n".join(pages)


def split_lines(text: str) -> list[str]:
    lines = []

    for raw_line in text.splitlines():
        line = normalize_text(raw_line)

        if line:
            lines.append(line)

    return lines


def parse_delimited_line(
    line: str,
    headers: list[str],
) -> dict[str, Any] | None:
    if "|" in line:
        parts = [
            normalize_text(part)
            for part in line.split("|")
        ]
    elif "\t" in line:
        parts = [
            normalize_text(part)
            for part in line.split("\t")
        ]
    elif "," in line:
        parts = [
            normalize_text(part)
            for part in line.split(",")
        ]
    else:
        return None

    if len(parts) < 2:
        return None

    if len(parts) != len(headers):
        return None

    result: dict[str, Any] = {}

    for index, value in enumerate(parts):
        field = detect_field(headers[index])

        if field:
            result[field] = value

    if not result.get("full_name"):
        return None

    result["role"] = normalize_role(
        result.get("role")
    )

    result["contact_number"] = clean_phone(
        result.get("contact_number")
    )

    for key in list(result.keys()):
        if isinstance(result[key], str):
            result[key] = clean_value(result[key])

    return result


def detect_header_line(lines: list[str]) -> tuple[int, list[str]] | None:
    for index, line in enumerate(lines[:20]):
        if "|" in line:
            headers = [
                normalize_text(part)
                for part in line.split("|")
            ]
        elif "\t" in line:
            headers = [
                normalize_text(part)
                for part in line.split("\t")
            ]
        elif "," in line:
            headers = [
                normalize_text(part)
                for part in line.split(",")
            ]
        else:
            continue

        recognized = sum(
            1
            for header in headers
            if detect_field(header)
        )

        if recognized >= 2:
            return index, headers

    return None


def parse_table(
    lines: list[str],
) -> list[dict[str, Any]]:
    detected = detect_header_line(lines)

    if not detected:
        return []

    header_index, headers = detected

    records: list[dict[str, Any]] = []

    for line in lines[header_index + 1 :]:
        record = parse_delimited_line(
            line,
            headers,
        )

        if record:
            records.append(record)

    return records


def parse_key_value_records(
    lines: list[str],
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []

    current: dict[str, Any] = {}

    pattern = re.compile(
        r"^\s*([^:]+?)\s*:\s*(.*?)\s*$"
    )

    def flush() -> None:
        nonlocal current

        if current.get("full_name"):
            current["role"] = normalize_role(
                current.get("role")
            )

            current["contact_number"] = clean_phone(
                current.get("contact_number")
            )

            records.append(current.copy())

        current = {}

    for line in lines:
        match = pattern.match(line)

        if not match:
            continue

        raw_key = normalize_header(
            match.group(1)
        )

        value = normalize_text(
            match.group(2)
        )

        field = detect_field(raw_key)

        if not field:
            continue

        if (
            field == "full_name"
            and current.get("full_name")
        ):
            flush()

        current[field] = value

    flush()

    return records


def remove_duplicates(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    unique: list[dict[str, Any]] = []

    seen: set[str] = set()

    for record in records:
        enrollment = (
            record.get("enrollment_no")
            or ""
        ).strip().lower()

        name = (
            record.get("full_name")
            or ""
        ).strip().lower()

        key = (
            f"id:{enrollment}"
            if enrollment
            else f"name:{name}"
        )

        if key in seen:
            continue

        seen.add(key)
        unique.append(record)

    return unique


def parse_people_pdf(
    pdf_bytes: bytes,
) -> dict[str, Any]:
    text = extract_pdf_text(pdf_bytes)

    if not text.strip():
        return {
            "success": False,
            "message": (
                "No text could be extracted "
                "from this PDF."
            ),
            "records": [],
            "raw_text": "",
        }

    lines = split_lines(text)

    records = parse_table(lines)

    if not records:
        records = parse_key_value_records(
            lines
        )

    records = remove_duplicates(
        records
    )

    for index, record in enumerate(records):
        record["import_index"] = index

        record.setdefault(
            "full_name",
            None,
        )

        record.setdefault(
            "role",
            "student",
        )

        record.setdefault(
            "enrollment_no",
            None,
        )

        record.setdefault(
            "year",
            None,
        )

        record.setdefault(
            "branch",
            None,
        )

        record.setdefault(
            "contact_number",
            None,
        )

    return {
        "success": True,
        "message": (
            f"Detected {len(records)} "
            "people."
        ),
        "records": records,
        "raw_text": text[:10000],
    }