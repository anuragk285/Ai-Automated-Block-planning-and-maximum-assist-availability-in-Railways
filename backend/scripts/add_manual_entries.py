'''Python script to insert a new Train and BlockSection into the database.'''
import sys, os, json
# Add project root to PYTHONPATH and ensure working directory is the backend folder
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(project_root)
os.chdir(project_root)

from app.database import SessionLocal, engine, Base
# Import models so that Base knows about their tables before creating them
from app.models.db_models import Train, BlockSection

# Ensure all tables exist (including BlockSection)
Base.metadata.create_all(bind=engine)

def add_entries():
    db = SessionLocal()
    try:
        # 1. Insert Train ADI -> NGP (Vande Bharat Special)
        adi_ngp_path = json.dumps(["ADI", "BRC", "ST", "NDB", "BSL", "AK", "WR", "NGP"])

        # Check if train already exists, update or insert
        existing_train = db.query(Train).filter_by(train_id="TRN_ADI_NGP_001").first()
        if existing_train:
            existing_train.train_number = "20820"
            existing_train.train_name = "Vande Bharat Special"
            existing_train.train_type = "Vande Bharat"
            existing_train.priority_class = 1
            existing_train.origin_station_code = "ADI"
            existing_train.destination_station_code = "NGP"
            existing_train.scheduled_departure_time = "20:03"
            existing_train.scheduled_arrival_time = "23:16"
            existing_train.current_status = "Scheduled"
            existing_train.current_section_code = "ADI"
            existing_train.original_path_json = adi_ngp_path
            existing_train.assigned_path_json = adi_ngp_path
        else:
            new_train = Train(
                train_id="TRN_ADI_NGP_001",
                train_number="20820",
                train_name="Vande Bharat Special",
                train_type="Vande Bharat",
                priority_class=1,
                origin_station_code="ADI",
                destination_station_code="NGP",
                scheduled_departure_time="20:03",
                scheduled_arrival_time="23:16",
                current_status="Scheduled",
                current_section_code="ADI",
                original_path_json=adi_ngp_path,
                assigned_path_json=adi_ngp_path,
            )
            db.add(new_train)

        # 2. Insert BlockSection NDLS -> BPL at 21:00
        existing_block = db.query(BlockSection).filter_by(section_id="SEC_STNNDLS_STNBPL").first()
        if existing_block:
            existing_block.block_group_id = "BLK-GRP_SEC_STNNDLS_STNBPL_14"
            existing_block.track_number = 1
            existing_block.start_time = "21:00"
            existing_block.duration = "01:00"
            existing_block.status = "Proposed"
            existing_block.traffic_sensitivity = "High"
            existing_block.from_station_code = "NDLS"
            existing_block.to_station_code = "BPL"
        else:
            new_block = BlockSection(
                section_id="SEC_STNNDLS_STNBPL",
                block_group_id="BLK-GRP_SEC_STNNDLS_STNBPL_14",
                track_number=1,
                start_time="21:00",
                duration="01:00",
                status="Proposed",
                traffic_sensitivity="High",
                from_station_code="NDLS",
                to_station_code="BPL"
            )
            db.add(new_block)

        db.commit()
        print("✅ Added train TRN_ADI_NGP_001 and block section SEC_STNNDLS_STNBPL successfully.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    add_entries()

