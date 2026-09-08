import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from app.database import SessionLocal, engine, Base
from app.data_access.db_source import DBSource
from app.database import SessionLocal, engine, Base
from app.data_access.db_source import DBSource

def test_add_block_section_computes_and_persists_reroutes():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        source = DBSource(db)

        # 2. Add block section on GZB -> ALJN
        block_payload = {
            "section_id": "SEC_TEST_GZB_ALJN",
            "block_group_id": "BG_TEST_01",
            "track_number": 1,
            "start_time": "21:00",
            "duration": "02:00",
            "status": "Proposed",
            "traffic_sensitivity": "High",
            "from_station_code": "GZB",
            "to_station_code": "ALJN"
        }
        res = source.add_block_section(block_payload)
        assert res["rerouted_count"] > 0
        assert len(res["rerouted_trains"]) > 0

        # 3. Check get_trains(status="rerouted")
        rerouted = source.get_trains(status="rerouted")
        assert len(rerouted) > 0
        first_rerouted = rerouted[0]
        assert first_rerouted["current_status"] == "rerouted"
        assert first_rerouted["assigned_path"] is not None
        assert len(first_rerouted["assigned_path"]) > 0

        # 4. Check get_impacted_trains_for_block
        impacted = source.get_impacted_trains_for_block("GZB", "ALJN")
        assert len(impacted) > 0
        assert any(t.get("assigned_path") is not None for t in impacted)
        print(f"\n[Test Passed] Rerouted count: {res['rerouted_count']}. First rerouted: {first_rerouted['train_id']} with {len(first_rerouted['assigned_path'])} stops.")
    finally:
        db.close()
