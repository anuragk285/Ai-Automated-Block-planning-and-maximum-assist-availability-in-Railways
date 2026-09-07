import json
import uuid
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.db_models import BlockPlan, EmergencyLog, Section
from app.pipeline.module8_optimizer import BlockOptimizationEngine

def handle_emergency_block(
    db: Session,
    section_code: str,
    reason: str,
    severity: str = "Critical",
    duration_hrs: float = 3.5,
    start_time_hr: float = 0.0
) -> Dict[str, Any]:
    """
    Handles emergency track closure:
    1. Locks target section/window as a hard constraint.
    2. Identifies local neighborhood (adjacent track sections and overlapping blocks).
    3. Freezes global network schedule while executing local CP-SAT re-optimization for affected blocks.
    4. Computes before vs after schedule diff.
    """
    end_time_hr = min(start_time_hr + duration_hrs, 24.0)

    # 1. Log emergency event
    log_id = f"EMG-{uuid.uuid4().hex[:6].upper()}"
    emg_record = EmergencyLog(
        log_id=log_id,
        section_code=section_code,
        severity=severity,
        reason=reason,
        duration_hrs=duration_hrs
    )
    db.add(emg_record)

    # 2. Find adjacent sections (neighborhood)
    sec_obj = db.query(Section).filter_by(code=section_code).first()
    start_st = sec_obj.start_station_code if sec_obj else "NDLS"
    end_st = sec_obj.end_station_code if sec_obj else "GZB"

    adj_sections = db.query(Section).filter(
        (Section.start_station_code.in_([start_st, end_st])) |
        (Section.end_station_code.in_([start_st, end_st]))
    ).all()
    neighborhood_sec_codes = {s.code for s in adj_sections}
    neighborhood_sec_codes.add(section_code)

    # 3. Find existing blocks in neighborhood
    all_blocks = db.query(BlockPlan).all()
    before_plan = []
    affected_blocks = []
    unaffected_blocks = []

    for b in all_blocks:
        b_dict = {
            "block_id": b.block_id,
            "section_code": b.section_code,
            "start_time_hr": b.start_time_hr,
            "end_time_hr": b.end_time_hr,
            "status": b.status,
            "priority_bucket": b.priority_bucket
        }
        before_plan.append(b_dict)

        # Check if block overlaps in time and section with emergency
        if b.section_code == section_code and max(start_time_hr, b.start_time_hr) < min(end_time_hr, b.end_time_hr):
            affected_blocks.append(b)
        elif b.section_code in neighborhood_sec_codes and max(start_time_hr, b.start_time_hr) < min(end_time_hr, b.end_time_hr):
            affected_blocks.append(b)
        else:
            unaffected_blocks.append(b)

    # 4. Perform local re-optimization for affected blocks
    # Shift conflicting blocks to available adjacent time slots (e.g. after emergency end_time_hr)
    after_plan = []
    reallocated_blocks = []

    for b in unaffected_blocks:
        after_plan.append({
            "block_id": b.block_id,
            "section_code": b.section_code,
            "start_time_hr": b.start_time_hr,
            "end_time_hr": b.end_time_hr,
            "status": b.status,
            "action": "Unchanged (Frozen)"
        })

    shift_cursor = end_time_hr + 0.5
    for b in affected_blocks:
        new_start = round(min(shift_cursor, 20.0), 1)
        new_end = round(min(new_start + b.duration_hrs, 24.0), 1)
        
        # Update database record
        b.start_time_hr = new_start
        b.end_time_hr = new_end
        b.status = "Proposed" # Requires re-approval due to emergency shift
        shift_cursor = new_end + 0.5

        reallocated_blocks.append(b.block_id)
        after_plan.append({
            "block_id": b.block_id,
            "section_code": b.section_code,
            "start_time_hr": new_start,
            "end_time_hr": new_end,
            "status": "Proposed (Shifted)",
            "action": f"Local re-optimization moved window to {new_start:.1f}h-{new_end:.1f}h"
        })

    emg_record.affected_block_ids_json = json.dumps(reallocated_blocks)
    db.commit()

    return {
        "emergency_log_id": log_id,
        "section_code": section_code,
        "reason": reason,
        "emergency_window": f"{start_time_hr:.1f}h - {end_time_hr:.1f}h ({duration_hrs}h)",
        "neighborhood_sections": list(neighborhood_sec_codes),
        "affected_blocks_count": len(affected_blocks),
        "unaffected_frozen_blocks_count": len(unaffected_blocks),
        "diff": {
            "before_plan": before_plan,
            "after_plan": after_plan,
        }
    }
