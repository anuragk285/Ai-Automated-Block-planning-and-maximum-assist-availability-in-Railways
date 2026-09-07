import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from fastapi.testclient import TestClient
from app.main import app

from app.database import SessionLocal, engine, Base
from app.models.db_models import Train, BlockSection

client = TestClient(app)

def setup_module(module):
    """Ensure DB tables exist prior to test execution."""
    Base.metadata.create_all(bind=engine)

def test_insert_train_and_verify_fields():
    """Insert train TRN_ADI_NGP_001 via API and verify all fields match in DB."""
    payload = {
        "train_id": "TRN_ADI_NGP_001",
        "train_number": "20820",
        "train_name": "Vande Bharat Special",
        "train_type": "Vande Bharat",
        "priority_class": 1,
        "origin_station_code": "ADI",
        "destination_station_code": "NGP",
        "scheduled_departure_time": "20:03",
        "scheduled_arrival_time": "23:16",
        "current_status": "Scheduled",
        "current_section_code": "ADI",
        "original_path_json": ["ADI", "BRC", "ST", "NDB", "BSL", "AK", "WR", "NGP"],
        "assigned_path_json": ["ADI", "BRC", "ST", "NDB", "BSL", "AK", "WR", "NGP"]
    }

    # POST insert
    response = client.post("/api/trains", json=payload)
    assert response.status_code == 201, f"Expected 201 Created, got {response.status_code}: {response.text}"
    data = response.json()
    assert data["status"] == "success"

    # Re-select immediately and verify all submitted field values match
    get_resp = client.get("/api/trains/TRN_ADI_NGP_001")
    assert get_resp.status_code == 200, f"Expected 200 OK, got {get_resp.status_code}"
    train = get_resp.json()

    assert train["train_id"] == "TRN_ADI_NGP_001"
    assert train["train_number"] == "20820"
    assert train["train_name"] == "Vande Bharat Special"
    assert train["train_type"] == "Vande Bharat"
    assert train["priority_class"] == 1
    assert train["origin_station_code"] == "ADI"
    assert train["destination_station_code"] == "NGP"
    assert train["scheduled_departure_time"] == "20:03"
    assert train["scheduled_arrival_time"] == "23:16"
    assert train["current_status"] == "Scheduled"
    assert train["original_path"] == ["ADI", "BRC", "ST", "NDB", "BSL", "AK", "WR", "NGP"]

def test_insert_train_missing_not_null_fails():
    """Verify that missing required NOT NULL fields return HTTP 400 error."""
    payload = {
        "train_id": "TRN_INVALID_001",
        "train_number": "",  # Empty required field
        "train_name": "Test Train",
        "train_type": "Express",
        "origin_station_code": "NDLS",
        "destination_station_code": "BPL",
        "scheduled_departure_time": "10:00",
        "scheduled_arrival_time": "14:00"
    }
    response = client.post("/api/trains", json=payload)
    assert response.status_code == 400
    assert "Missing required NOT NULL field" in response.json()["detail"]

def test_insert_block_section_and_verify_fields():
    """Insert block section SEC_STNNDLS_STNBPL via API and verify persistence."""
    payload = {
        "section_id": "SEC_STNNDLS_STNBPL",
        "block_group_id": "BLK-GRP_SEC_STNNDLS_STNBPL_14",
        "track_number": 1,
        "start_time": "21:00",
        "duration": "01:00",
        "status": "Proposed",
        "traffic_sensitivity": "High",
        "from_station_code": "NDLS",
        "to_station_code": "BPL"
    }

    # POST insert
    response = client.post("/api/block-sections", json=payload)
    assert response.status_code == 201, f"Expected 201 Created, got {response.status_code}: {response.text}"

    # GET list and verify
    get_resp = client.get("/api/block-sections")
    assert get_resp.status_code == 200
    sections = get_resp.json()
    
    target = next((s for s in sections if s["section_id"] == "SEC_STNNDLS_STNBPL"), None)
    assert target is not None, "Inserted block section not found in database"
    assert target["block_group_id"] == "BLK-GRP_SEC_STNNDLS_STNBPL_14"
    assert target["track_number"] == 1
    assert target["start_time"] == "21:00"
    assert target["duration"] == "01:00"
    assert target["status"] == "Proposed"
    assert target["traffic_sensitivity"] == "High"
    assert target["from_station_code"] == "NDLS"
    assert target["to_station_code"] == "BPL"

def test_insert_block_section_missing_not_null_fails():
    """Verify that missing required NOT NULL fields in block section return HTTP 400 error."""
    payload = {
        "section_id": "SEC_BAD",
        "block_group_id": "",
        "start_time": "12:00",
        "duration": "02:00",
        "from_station_code": "NDLS",
        "to_station_code": "BPL"
    }
    response = client.post("/api/block-sections", json=payload)
    assert response.status_code == 400
    assert "Missing required NOT NULL field" in response.json()["detail"]

def test_dynamic_train_impact_evaluation():
    """
    Verify dynamic block-to-train impact calculation:
    - TRN_ADI_NGP_001 (ADI->NGP) is NOT impacted by NDLS->BPL block.
    - A train passing through NDLS->BPL IS marked as impacted.
    """
    # 1. Insert a train that passes through NDLS -> BPL
    ndls_bpl_train = {
        "train_id": "TRN_NDLS_BPL_TEST",
        "train_number": "12004",
        "train_name": "Shatabdi Express NDLS-BPL",
        "train_type": "Express",
        "priority_class": 1,
        "origin_station_code": "NDLS",
        "destination_station_code": "BPL",
        "scheduled_departure_time": "06:00",
        "scheduled_arrival_time": "14:00",
        "current_status": "Scheduled",
        "original_path_json": ["NDLS", "BPL", "ET", "NGP"],
        "assigned_path_json": ["NDLS", "BPL", "ET", "NGP"]
    }
    client.post("/api/trains", json=ndls_bpl_train)

    # 2. Query impact for NDLS -> BPL
    resp = client.get("/api/block-sections/impact?from_station_code=NDLS&to_station_code=BPL")
    assert resp.status_code == 200
    data = resp.json()
    impacted_ids = [t["train_id"] for t in data["impacted_trains"]]

    # Assert TRN_ADI_NGP_001 is NOT impacted
    assert "TRN_ADI_NGP_001" not in impacted_ids, "TRN_ADI_NGP_001 should NOT be impacted by NDLS-BPL block"

    # Assert TRN_NDLS_BPL_TEST IS impacted
    assert "TRN_NDLS_BPL_TEST" in impacted_ids, "TRN_NDLS_BPL_TEST should be impacted by NDLS-BPL block"
