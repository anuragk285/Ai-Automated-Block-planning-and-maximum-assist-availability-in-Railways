import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, SessionLocal
from app.routers import api
from app.data_access.synthetic_generator import seed_database
from app.models.db_models import Station

app = FastAPI(
    title="AI-Assisted Automatic Block Planning System",
    description="Indian Railways Maintenance Block Optimization System (SIH26027 Prototype)",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    """Create database tables and auto-seed if empty."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Auto-seed if database has no stations
        if db.query(Station).count() == 0:
            print("[Startup] Empty database detected. Auto-seeding synthetic scenario...")
            seed_database(db, seed=42)
    finally:
        db.close()

# Include API Router
app.include_router(api.router, prefix="/api")

@app.get("/")
def root_endpoint():
    return {
        "system": "Indian Railways AI Block Planning System",
        "status": "Operational",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
