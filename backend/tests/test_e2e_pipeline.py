import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "Operational"

def test_api_seed_endpoint():
    response = client.post("/api/data/seed", json={"seed": 42})
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_api_get_requests():
    response = client.get("/api/requests")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert "ml_asset_risk_score" in data[0]

def test_api_get_network():
    response = client.get("/api/network")
    assert response.status_code == 200
    data = response.json()
    assert len(data["stations"]) > 0
    assert len(data["sections"]) > 0

def test_api_run_optimization():
    response = client.post("/api/optimize")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["blocks"]) > 0

def test_api_approve_reject_block():
    # First get generated blocks
    plan_resp = client.get("/api/plan")
    assert plan_resp.status_code == 200
    blocks = plan_resp.json()
    assert len(blocks) > 0

    target_block_id = blocks[0]["block_id"]

    # Approve test
    app_resp = client.post(f"/api/plan/{target_block_id}/approve")
    assert app_resp.status_code == 200
    assert app_resp.json()["status"] == "Approved"

    # Reject test
    if len(blocks) > 1:
        target_reject_id = blocks[1]["block_id"]
        rej_resp = client.post(f"/api/plan/{target_reject_id}/reject", json={"reason": "Conflict with VIP Train movement"})
        assert rej_resp.status_code == 200
        assert rej_resp.json()["status"] == "Rejected"

def test_api_drift_simulation():
    response = client.post("/api/monitor/simulate-drift")
    assert response.status_code == 200
    assert "drift_alerts_count" in response.json()

def test_api_emergency_handling():
    payload = {
        "section_code": "SEC_GZB_ALJN",
        "reason": "Sudden OHE Catenary Wire Snapping",
        "severity": "Critical",
        "duration_hrs": 3.0,
        "start_time_hr": 2.0
    }
    response = client.post("/api/emergency", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["section_code"] == "SEC_GZB_ALJN"
    assert "diff" in data
