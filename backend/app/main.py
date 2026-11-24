from contextlib import asynccontextmanager

from fastapi import FastAPI

from fastapi.middleware.cors import (
    CORSMiddleware,
)

from app.database.database import (
    initialize_database,
)

from app.api.people import (
    router as people_router,
)

from app.api.recognition import (
    router as recognition_router,
)

from app.api.enrollment import (
    router as enrollment_router,
)

from app.api.camera import (
    router as camera_router,
)

from app.api.statistics import (
    router as statistics_router,
)

from routes.pdf_import import (
    router as pdf_import_router,
)

from routes.id_card_import import (
    router as id_card_router,
)


# ============================================================
# STARTUP
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    print()
    print("=" * 60)
    print("SMART CAMPUS VISION")
    print("=" * 60)

    initialize_database()

    print(
        "SYSTEM: Database initialization complete"
    )

    print(
        "SYSTEM: API routers initialized"
    )

    print("=" * 60)
    print()

    yield

    print()
    print(
        "SMART CAMPUS VISION: Shutdown"
    )


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="Smart Campus Vision",

    description=(
        "AI-powered campus face recognition "
        "and identity management system."
    ),

    version="1.0.0",

    lifespan=lifespan,
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ],

    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ============================================================
# ROUTERS
# ============================================================

app.include_router(
    people_router
)

app.include_router(
    recognition_router
)

app.include_router(
    enrollment_router
)

app.include_router(
    camera_router
)

app.include_router(
    statistics_router
)

app.include_router(
    pdf_import_router
)

app.include_router(
    id_card_router
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "success": True,

        "application": (
            "Smart Campus Vision"
        ),

        "version": "1.0.0",

        "status": "online",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {
        "success": True,

        "status": "healthy",

        "service": (
            "smart-campus-vision"
        ),
    }