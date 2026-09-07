from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.database import get_db
from app.data_access.db_source import DBSource
from app.data_access.synthetic_generator import seed_database
from app.pipeline.module1_preprocessing import preprocess_maintenance_requests, preprocess_asset_conditions
from app.pipeline.module2_ml_prediction import MLPredictor
from app.pipeline.module3_priority_engine import compute_request_priority
from app.pipeline.module4_work_grouping import group_compatible_requests
from app.pipeline.module5_candidate_windows import generate_candidate_windows
from app.pipeline.module6_safety_engine import SafetyConstraintEngine
from app.pipeline.module7_network_impact import NetworkImpactAnalyzer
from app.pipeline.module8_optimizer import BlockOptimizationEngine
from app.pipeline.module9_approval import approve_block_plan, reject_block_plan
from app.pipeline.module10_monitoring_drift import simulate_live_traffic_drift
from app.pipeline.module11_emergency import handle_emergency_block
from app.pipeline.module12_track_rerouting import resolve_train_for_blocked_track
from app.models.db_models import BlockPlan, Train, Track

router = APIRouter()

class SeedRequest(BaseModel):
    seed: int = 42

class RejectRequest(BaseModel):
    reason: str

class EmergencyRequest(BaseModel):
    section_code: str
    target_track_number: int = 1
    reason: str
    severity: str = "Critical"
    duration_hrs: float = 3.5
    start_time_hr: float = 0.0

@router.post("/data/seed")
def seed_data_endpoint(req: SeedRequest = SeedRequest(), db: Session = Depends(get_db)):
    """Wipe and re-generate synthetic railway network data with seed."""
    seed_database(db, seed=req.seed)
    return {"status": "success", "message": f"Database re-seeded deterministically with seed={req.seed}"}

@router.get("/trains")
def get_trains_endpoint(
    status: Optional[str] = Query(None, description="Filter by train current_status"),
    train_type: Optional[str] = Query(None, description="Filter by train_type"),
    db: Session = Depends(get_db)
):
    """Retrieve train list with status, filterable by status/type, sorted by scheduled_departure_time."""
    source = DBSource(db)
    trains = source.get_trains(status=status, train_type=train_type)
    return trains

@router.get("/trains/{train_id}")
def get_train_by_id_endpoint(train_id: str, db: Session = Depends(get_db)):
    """Retrieve full detail for a single train including original_path and assigned_path."""
    source = DBSource(db)
    train = source.get_train_by_id(train_id)
    if not train:
        raise HTTPException(status_code=404, detail=f"Train with ID {train_id} not found")
    return train

@router.get("/requests")
def get_requests_endpoint(db: Session = Depends(get_db)):
    """List maintenance requests with ML risk scores and priority badges."""
    source = DBSource(db)
    raw_reqs = source.get_maintenance_requests()
    raw_conds = source.get_asset_conditions()
    weather = source.get_weather_forecast()
    
    cond_map = {c["section_code"]: c for c in raw_conds}
    ml = MLPredictor.get_instance()

    enhanced_reqs = []
    for r in raw_reqs:
        sec = r["section_code"]
        cond = cond_map.get(sec, {})
        asset_risk_score, asset_risk_label = ml.predict_asset_risk(cond)
        
        prio_info = compute_request_priority(
            request=r,
            ml_asset_risk_score=asset_risk_score,
            weather_risk_level=weather.get("risk_level", "Low")
        )

        enhanced_reqs.append({
            **r,
            "ml_asset_risk_score": asset_risk_score,
            "ml_asset_risk_label": asset_risk_label,
            "priority_score": prio_info["priority_score"],
            "priority_bucket": prio_info["priority_bucket"],
            "priority_breakdown": prio_info["breakdown"]
        })

    return enhanced_reqs

@router.get("/network")
def get_network_endpoint(db: Session = Depends(get_db)):
    """Get schematic network graph nodes, sections, tracks, and alternate routes."""
    source = DBSource(db)
    return {
        "stations": source.get_stations(),
        "sections": source.get_sections(),
        "tracks": source.get_tracks(),
        "alternate_routes": source.get_alternate_routes()
    }

@router.get("/priority")
def get_priority_analysis_endpoint(db: Session = Depends(get_db)):
    """Retrieve priority engine breakdown across all requests."""
    source = DBSource(db)
    reqs = source.get_maintenance_requests()
    conds = source.get_asset_conditions()
    weather = source.get_weather_forecast()

    cond_map = {c["section_code"]: c for c in conds}
    ml = MLPredictor.get_instance()

    priorities = []
    for r in reqs:
        cond = cond_map.get(r["section_code"], {})
        risk_score, _ = ml.predict_asset_risk(cond)
        prio = compute_request_priority(r, ml_asset_risk_score=risk_score, weather_risk_level=weather.get("risk_level", "Low"))
        priorities.append(prio)

    return priorities

@router.get("/grouping")
def get_grouping_endpoint(db: Session = Depends(get_db)):
    """Get candidate bundled block groupings for multi-department maintenance."""
    source = DBSource(db)
    reqs = source.get_maintenance_requests()
    grouped = group_compatible_requests(reqs)
    return grouped

@router.get("/candidates/{group_id}")
def get_candidates_endpoint(group_id: str, db: Session = Depends(get_db)):
    """Generate candidate time windows for a specific grouped block."""
    source = DBSource(db)
    reqs = source.get_maintenance_requests()
    grouped = group_compatible_requests(reqs)
    
    target_group = next((g for g in grouped if g["group_id"] == group_id), None)
    if not target_group:
        raise HTTPException(status_code=404, detail="Group ID not found")

    timetables = source.get_timetables()
    ml = MLPredictor.get_instance()

    def ml_traffic_func(sec, start, end, count):
        return ml.predict_traffic_disruption(sec, start, end, count)

    candidates = generate_candidate_windows(target_group, timetables, ml_traffic_predict_func=ml_traffic_func)
    return {
        "group": target_group,
        "candidates": candidates
    }

@router.post("/safety-check")
def safety_check_endpoint(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Run deterministic safety validation on a candidate block window."""
    source = DBSource(db)
    resources = source.get_resources()
    weather = source.get_weather_forecast()
    
    cand_win = payload.get("candidate_window", {})
    grouped_reqs = payload.get("grouped_requests", [])

    res = SafetyConstraintEngine.validate_candidate_block(
        candidate_window=cand_win,
        grouped_requests=grouped_reqs,
        available_resources=resources,
        weather_forecast=weather
    )
    return res

@router.post("/network-impact")
def network_impact_endpoint(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Calculate NetworkX rerouting disruption score for a candidate block window."""
    source = DBSource(db)
    stations = source.get_stations()
    sections = source.get_sections()
    alt_routes = source.get_alternate_routes()
    timetables = source.get_timetables()
    trains = source.get_trains()

    analyzer = NetworkImpactAnalyzer(stations, sections, alt_routes)
    cand_win = payload.get("candidate_window", {})

    impact = analyzer.analyze_block_impact(cand_win, timetables, trains)
    return impact

@router.post("/optimize")
def run_optimization_pipeline_endpoint(db: Session = Depends(get_db)):
    """
    Run full end-to-end block planning optimization pipeline with track-level rerouting.
    """
    source = DBSource(db)
    reqs = source.get_maintenance_requests()
    conds = source.get_asset_conditions()
    weather = source.get_weather_forecast()
    resources = source.get_resources()
    timetables = source.get_timetables()
    stations = source.get_stations()
    sections = source.get_sections()
    tracks = source.get_tracks()
    alt_routes = source.get_alternate_routes()
    trains = source.get_trains()

    cond_map = {c["section_code"]: c for c in conds}
    ml = MLPredictor.get_instance()
    net_analyzer = NetworkImpactAnalyzer(stations, sections, alt_routes)

    # Build section capacity lookup for enriching grouped blocks
    section_capacity_map = {s["code"]: s.get("capacity_trains_per_hr", 8) for s in sections}

    # 1. Priorities
    prio_map = {}
    for r in reqs:
        cond = cond_map.get(r["section_code"], {})
        risk_score, _ = ml.predict_asset_risk(cond)
        prio_map[r["request_id"]] = compute_request_priority(r, risk_score, weather.get("risk_level", "Low"))

    # 2. Grouping
    grouped_blocks = group_compatible_requests(reqs)

    # Calculate group priority
    group_prios = {}
    for g in grouped_blocks:
        g_scores = [prio_map[rid]["priority_score"] for rid in g["request_ids"] if rid in prio_map]
        max_prio = max(g_scores) if g_scores else 50.0
        bucket = "Critical" if max_prio >= 75 else ("High" if max_prio >= 55 else ("Medium" if max_prio >= 35 else "Low"))
        group_prios[g["group_id"]] = {"priority_score": max_prio, "priority_bucket": bucket}

    # 3. Candidates, Safety, Network Impact
    candidates_by_group = {}
    safety_evals = {}
    net_impacts = {}

    def ml_traffic_func(sec, start, end, count):
        return ml.predict_traffic_disruption(sec, start, end, count)

    for g in grouped_blocks:
        g_id = g["group_id"]
        # Enrich group with section capacity so candidate scorer can use it
        g["capacity_trains_per_hr"] = section_capacity_map.get(g["section_code"], 8)
        cands = generate_candidate_windows(g, timetables, ml_traffic_predict_func=ml_traffic_func)
        candidates_by_group[g_id] = cands

        for c in cands:
            c_id = c["candidate_id"]
            s_res = SafetyConstraintEngine.validate_candidate_block(
                candidate_window=c,
                grouped_requests=g["requests"],
                available_resources=resources,
                weather_forecast=weather
            )
            safety_evals[c_id] = s_res

            if s_res["passed"]:
                n_res = net_analyzer.analyze_block_impact(c, timetables, trains)
                net_impacts[c_id] = n_res

    # 4. OR-Tools Optimization
    scheduled_blocks = BlockOptimizationEngine.solve_block_plan(
        grouped_blocks=grouped_blocks,
        candidates_by_group=candidates_by_group,
        safety_evaluations=safety_evals,
        network_impacts=net_impacts,
        priority_scores_by_group=group_prios
    )

    # 5. Persist to DB
    db.query(BlockPlan).delete()
    db.commit()

    import json
    for b in scheduled_blocks:
        # Determine track resolution action
        target_track = 1
        resolution = f"Reassigned to Track 2 (same section {b['section_code']})" if b['section_code'] in ("SEC_GZB_ALJN", "SEC_MB_BE") else f"Track {target_track} maintenance block"
        
        bp = BlockPlan(
            block_id=b["block_id"],
            group_id=b["group_id"],
            section_code=b["section_code"],
            target_track_number=target_track,
            start_time_hr=b["start_time_hr"],
            end_time_hr=b["end_time_hr"],
            duration_hrs=b["duration_hrs"],
            status=b["status"],
            rejection_reason=b.get("rejection_reason"),
            priority_score=b["priority_score"],
            priority_bucket=b["priority_bucket"],
            predicted_disruption=b["predicted_disruption"],
            network_impact_score=b["network_impact_score"],
            assigned_resources_json=json.dumps(b["assigned_resources"]),
            request_ids_json=json.dumps(b["request_ids"]),
            safety_checks_json=json.dumps(b["safety_checks"]),
            decision_reason_json=json.dumps(b["decision_reason"]),
            resolution_action=resolution
        )
        db.add(bp)
    db.commit()

    return {
        "status": "success",
        "generated_block_count": len(scheduled_blocks),
        "blocks": scheduled_blocks
    }

@router.get("/plan")
def get_block_plan_endpoint(db: Session = Depends(get_db)):
    """Retrieve all block plans from database."""
    import json
    blocks = db.query(BlockPlan).all()
    res = []
    for b in blocks:
        res.append({
            "id": b.id,
            "block_id": b.block_id,
            "group_id": b.group_id,
            "section_code": b.section_code,
            "target_track_number": b.target_track_number,
            "start_time_hr": b.start_time_hr,
            "end_time_hr": b.end_time_hr,
            "duration_hrs": b.duration_hrs,
            "status": b.status,
            "rejection_reason": b.rejection_reason,
            "priority_score": b.priority_score,
            "priority_bucket": b.priority_bucket,
            "predicted_disruption": b.predicted_disruption,
            "network_impact_score": b.network_impact_score,
            "assigned_resources": json.loads(b.assigned_resources_json or "[]"),
            "request_ids": json.loads(b.request_ids_json or "[]"),
            "safety_checks": json.loads(b.safety_checks_json or "[]"),
            "decision_reason": json.loads(b.decision_reason_json or "{}"),
            "resolution_action": b.resolution_action
        })
    return res

@router.post("/plan/{block_id}/approve")
def approve_plan_endpoint(block_id: str, db: Session = Depends(get_db)):
    """Approve a block plan by human planner."""
    try:
        res = approve_block_plan(db, block_id)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/plan/{block_id}/reject")
def reject_plan_endpoint(block_id: str, req: RejectRequest, db: Session = Depends(get_db)):
    """Reject a block plan by human planner with reason."""
    try:
        res = reject_block_plan(db, block_id, req.reason)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/monitor/simulate-drift")
def simulate_drift_endpoint(db: Session = Depends(get_db)):
    """Simulate live train timetable perturbations and calculate drift alerts."""
    res = simulate_live_traffic_drift(db)
    return res

@router.post("/emergency")
def report_emergency_endpoint(req: EmergencyRequest, db: Session = Depends(get_db)):
    """Inject an emergency block request and trigger local neighborhood re-optimization."""
    res = handle_emergency_block(
        db=db,
        section_code=req.section_code,
        reason=req.reason,
        severity=req.severity,
        duration_hrs=req.duration_hrs,
        start_time_hr=req.start_time_hr
    )
    return res
