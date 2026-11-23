from __future__ import annotations

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    UploadFile,
)

from services.id_card_service import (
    parse_id_cards,
)


router = APIRouter(
    prefix="/api/id-card",
    tags=["ID Card Import"],
)


MAX_FILE_SIZE = 25 * 1024 * 1024


@router.post("/preview")
async def preview_id_cards(
    file: UploadFile = File(...),
):
    filename = (
        file.filename
        or ""
    ).lower()

    supported = (
        filename.endswith(".pdf")
        or filename.endswith(".jpg")
        or filename.endswith(".jpeg")
        or filename.endswith(".png")
    )

    if not supported:
        raise HTTPException(
            status_code=400,
            detail=(
                "Supported formats: "
                "PDF, JPG, JPEG, PNG."
            ),
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=(
                "File is too large. "
                "Maximum size is 25 MB."
            ),
        )

    try:

        result = parse_id_cards(
            file_bytes,
            file.filename or "upload",
        )

        return {
            "filename": file.filename,
            **result,
        }

    except Exception as exc:

        raise HTTPException(
            status_code=422,
            detail=(
                "ID card processing failed: "
                f"{exc}"
            ),
        ) from exc