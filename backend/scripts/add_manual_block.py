import sys, os
# Ensure script runs against same SQLite DB as FastAPI
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(project_root)
os.chdir(project_root)

from app.database import SessionLocal, engine, Base
Base.metadata.create_all(bind=engine)

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.db_models import BlockPlan
import uuid

def add_block_plan():
    db: Session = SessionLocal()
    try:
        block = BlockPlan(
            block_id=str(uuid.uuid4()),
            group_id="manual_high_pri",
            section_code="SEC_NDLS_BPL",
            target_track_number=1,
            start_time_hr=21.0,
            end_time_hr=23.0,
            duration_hrs=2.0,
            status="Proposed",
            priority_score=95.0,
            priority_bucket="High",
            predicted_disruption=0.0,
            network_impact_score=0.0,
            assigned_resources_json="[]",
            request_ids_json="[]",
            safety_checks_json="{}",
            decision_reason_json="{}",
            resolution_action="Manual high‑priority block",
        )
        db.add(block)
        db.commit()
        print("✅ Added manual block plan successfully.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error adding block plan: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    add_block_plan()
