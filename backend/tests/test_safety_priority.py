import pytest
from app.pipeline.module3_priority_engine import compute_request_priority
from app.pipeline.module6_safety_engine import SafetyConstraintEngine

def test_priority_engine_calculation():
    req = {
        "request_id": "REQ-ENG-TEST",
        "declared_urgency": 5, # Critical
        "due_date_days": 1,    # Urgent due date pressure
    }
    
    result = compute_request_priority(
        request=req,
        ml_asset_risk_score=0.9, # High asset risk
        weather_risk_level="High"
    )

    assert result["request_id"] == "REQ-ENG-TEST"
    assert result["priority_score"] >= 75.0
    assert result["priority_bucket"] == "Critical"
    assert "breakdown" in result

def test_safety_engine_skill_pass():
    candidate_window = {"section_code": "SEC_GZB_ALJN", "start_time_hr": 2.0, "end_time_hr": 4.5}
    grouped_requests = [
        {"request_id": "REQ-1", "department": "ENG", "required_skills": ["TRACK_WELDING"], "required_equipment": ["TAMPER_01"]}
    ]
    available_resources = [
        {"resource_type": "Crew", "skill_or_type": "TRACK_WELDING", "available_start_hr": 0.0, "available_end_hr": 24.0},
        {"resource_type": "Equipment", "skill_or_type": "TAMPER_01", "available_start_hr": 0.0, "available_end_hr": 24.0}
    ]
    weather = {"rainfall_mm": 5.0, "wind_speed_kmh": 10.0}

    result = SafetyConstraintEngine.validate_candidate_block(
        candidate_window=candidate_window,
        grouped_requests=grouped_requests,
        available_resources=available_resources,
        weather_forecast=weather
    )

    assert result["passed"] is True
    assert len(result["violation_reasons"]) == 0

def test_safety_engine_equipment_missing_reject():
    candidate_window = {"section_code": "SEC_GZB_ALJN", "start_time_hr": 2.0, "end_time_hr": 4.5}
    grouped_requests = [
        {"request_id": "REQ-1", "department": "TRAC", "required_skills": ["OHE_ALIGNMENT"], "required_equipment": ["MISSING_TOWER_WAGON"]}
    ]
    available_resources = [
        {"resource_type": "Crew", "skill_or_type": "OHE_ALIGNMENT", "available_start_hr": 0.0, "available_end_hr": 24.0}
    ]
    weather = {"rainfall_mm": 5.0, "wind_speed_kmh": 10.0}

    result = SafetyConstraintEngine.validate_candidate_block(
        candidate_window=candidate_window,
        grouped_requests=grouped_requests,
        available_resources=available_resources,
        weather_forecast=weather
    )

    assert result["passed"] is False
    assert result["hard_reject"] is True
    assert any("MISSING_TOWER_WAGON" in reason for reason in result["violation_reasons"])

def test_safety_engine_weather_reject():
    candidate_window = {"section_code": "SEC_GZB_ALJN", "start_time_hr": 2.0, "end_time_hr": 4.5}
    grouped_requests = [
        {"request_id": "REQ-1", "department": "ENG", "required_skills": ["TRACK_WELDING"], "required_equipment": []}
    ]
    available_resources = [
        {"resource_type": "Crew", "skill_or_type": "TRACK_WELDING", "available_start_hr": 0.0, "available_end_hr": 24.0}
    ]
    weather = {"rainfall_mm": 45.0, "wind_speed_kmh": 10.0} # Excessive rainfall

    result = SafetyConstraintEngine.validate_candidate_block(
        candidate_window=candidate_window,
        grouped_requests=grouped_requests,
        available_resources=available_resources,
        weather_forecast=weather
    )

    assert result["passed"] is False
    assert any("Heavy rainfall" in reason for reason in result["violation_reasons"])

def test_safety_engine_proximity_reject():
    candidate_window = {"section_code": "SEC_NDLS_GZB", "start_time_hr": 2.0, "end_time_hr": 4.0}
    grouped_requests = [
        {"request_id": "REQ-1", "department": "ENG", "required_skills": ["TRACK_WELDING"], "required_equipment": []}
    ]
    available_resources = [
        {"resource_type": "Crew", "skill_or_type": "TRACK_WELDING", "available_start_hr": 0.0, "available_end_hr": 24.0}
    ]
    weather = {"rainfall_mm": 0.0, "wind_speed_kmh": 5.0}

    # Existing block on adjacent section SEC_GZB_ALJN sharing GZB node
    existing_blocks = [
        {"block_id": "BLK-EX1", "section_code": "SEC_GZB_ALJN", "start_time_hr": 3.0, "end_time_hr": 5.0, "status": "Approved"}
    ]

    result = SafetyConstraintEngine.validate_candidate_block(
        candidate_window=candidate_window,
        grouped_requests=grouped_requests,
        available_resources=available_resources,
        weather_forecast=weather,
        existing_scheduled_blocks=existing_blocks
    )

    assert result["passed"] is False
    assert any("Proximity Safety Constraint" in reason for reason in result["violation_reasons"])

