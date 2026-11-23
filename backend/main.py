from contextlib import asynccontextmanager

from fastapi import FastAPI

from fastapi.middleware.cors import (
    CORSMiddleware,
)

from app.api.camera import (
    router as camera_router,
)

from app.api.people import (
    router as people_router,
)

from app.api.recognition import (
    router as recognition_router,
)

from app.api.statistics import (
    router as statistics_router,
)

from app.database.database import (
    Base,
    engine,
)

from routes.pdf_import import router as pdf_import_router

from routes.id_card_import import (
    router as id_card_router,
)

from routes.enrollment import router as enrollment_router



@asynccontextmanager
async def lifespan(app: FastAPI):

    Base.metadata.create_all(
        bind=engine
    )

    print(
        "================================"
    )

    print(
        "SMART CAMPUS VISION"
    )

    print(
        "Database initialized."
    )

    print(
        "================================"
    )

    yield

    print(
        "Smart Campus API shutting down."
    )


app = FastAPI(
    title="Smart Campus Vision API",
    description=(
        "Local development API for "
        "consent-based face verification."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(
    people_router
)

app.include_router(
    recognition_router
)

app.include_router(
    statistics_router
)

app.include_router(
    camera_router
)

app.include_router(
    pdf_import_router
)

app.include_router(
    id_card_router
)

app.include_router(
    enrollment_router
    )



@app.get("/")
def root():

    return {
        "name": "Smart Campus Vision",
        "status": "online",
        "version": "1.0.0",
    }


@app.get("/health")
def health():

    return {
        "status": "healthy"
    }