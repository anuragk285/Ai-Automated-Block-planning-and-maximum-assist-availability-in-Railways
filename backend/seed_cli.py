import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, Base, SessionLocal
from app.data_access.synthetic_generator import seed_database

def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db, seed=42)
        print("Database seeding completed via CLI.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
