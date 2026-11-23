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
    ],

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