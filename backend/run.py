import uvicorn
from app.database.database import Base, engine
from app.database.models import Person


def main():
    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully.")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()
