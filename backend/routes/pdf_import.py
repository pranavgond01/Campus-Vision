from __future__ import annotations

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    UploadFile,
)

from services.pdf_import_service import (
    parse_people_pdf,
)


router = APIRouter(
    prefix="/api/import",
    tags=["PDF Import"],
)


MAX_PDF_SIZE = 20 * 1024 * 1024


@router.post("/pdf/preview")
async def preview_pdf(
    file: UploadFile = File(...),
):
    filename = (
        file.filename or ""
    ).lower()

    if not filename.endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported.",
        )

    pdf_bytes = await file.read()

    if not pdf_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded PDF is empty.",
        )

    if len(pdf_bytes) > MAX_PDF_SIZE:
        raise HTTPException(
            status_code=413,
            detail="PDF is too large. Maximum size is 20 MB.",
        )

    try:
        result = parse_people_pdf(
            pdf_bytes
        )

        return {
            "filename": file.filename,
            **result,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not parse PDF: "
                f"{exc}"
            ),
        ) from exc