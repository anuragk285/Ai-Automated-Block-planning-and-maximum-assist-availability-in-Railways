'''Python script to insert a new Train and a high‑priority MaintenanceRequest into the database.'''
import sys, os
# Add project root to PYTHONPATH and ensure working directory is the backend folder
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(project_root)
os.chdir(project_root)

from app.database import SessionLocal, engine, Base
# Import models so that Base knows about their tables before creating them
from app.models.db_models import Train, MaintenanceRequest

# Ensure all tables exist (including MaintenanceRequest)
Base.metadata.create_all(bind=engine)

def add_entries():
    db = SessionLocal()
    try:
        # Train ADI -> NGP (Vandhe Bharath Special)
        new_train = Train(
            train_id="TRN-ADI-001",
            train_number="12001",
            train_name="Vandhe Bharath Special",
            train_type="Express",
            priority_class=1,
            origin_station_code="ADI",
            destination_station_code="NGP",
            scheduled_departure_time="20:03",
            scheduled_arrival_time="23:16",
            current_status="upcoming",
            original_path_json="[]",
            assigned_path_json=None,
        )
        db.add(new_train)

        # High‑priority maintenance request for NDLS‑BPL at 21:00 (urgency drives scheduling)
        new_block = MaintenanceRequest(
            request_id="REQ_NDLS_BPL_001",
            department="ENG",
            section_code="SEC_NDLS_BPL",
            target_track_number=1,
            location_km=0.0,
            defect_type="Scheduled Maintenance",
            requested_duration_hours=2.0,
            declared_urgency=5,  # Critical priority
            due_date_days=1,
            dependencies_json="[]",
            required_skills_json="[]",
            required_equipment_json="[]",
            status="Pending",
        )
        db.add(new_block)
        db.commit()
        print("✅ Added train and block request successfully.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    add_entries()
