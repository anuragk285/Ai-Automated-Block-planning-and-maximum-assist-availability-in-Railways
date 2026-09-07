from typing import List, Dict, Any

def group_compatible_requests(requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Combines compatible maintenance requests on the same section into unified block groups.
    Reduces total track possession time by merging multi-department activities (ENG, TRAC, ST).
    """
    if not requests:
        return []

    # Group by section_code
    section_map: Dict[str, List[Dict[str, Any]]] = {}
    for req in requests:
        sec = req.get("section_code")
        if sec not in section_map:
            section_map[sec] = []
        section_map[sec].append(req)

    grouped_blocks = []
    group_counter = 1

    for sec_code, req_list in section_map.items():
        # Check if multi-department merge is possible
        depts = {r.get("department") for r in req_list}

        # ── Duration: use correct field name 'requested_duration_hours' ──────
        # The DB serialises to 'requested_duration_hours'; fallback to 'requested_duration_hrs'
        # for backwards compatibility, then to 2.0h as last resort.
        durations = [
            float(
                r.get("requested_duration_hours")
                or r.get("requested_duration_hrs")
                or 2.0
            )
            for r in req_list
        ]
        max_dur = max(durations) if durations else 2.0
        # Combined block = max single-dept duration + 0.5h handover buffer
        combined_duration = round(max_dur + 0.5, 1)

        # ── Urgency & priority signals for candidate window scoring ──────────
        max_urgency = max((int(r.get("declared_urgency", 3)) for r in req_list), default=3)
        min_due_days = min((int(r.get("due_date_days", 5)) for r in req_list), default=5)

        # Union of skills and equipment
        combined_skills = set()
        combined_equip = set()
        request_ids = []

        for r in req_list:
            request_ids.append(r.get("request_id"))
            for s in r.get("required_skills", []):
                combined_skills.add(s)
            for e in r.get("required_equipment", []):
                combined_equip.add(e)

        grouped_blocks.append({
            "group_id": f"GRP_{sec_code}_{group_counter:02d}",
            "section_code": sec_code,
            "departments": list(depts),
            "department_count": len(depts),
            "request_ids": request_ids,
            "requests": req_list,
            "combined_duration_hrs": combined_duration,
            "combined_required_skills": list(combined_skills),
            "combined_required_equipment": list(combined_equip),
            "merged_work": len(req_list) > 1,
            # Extra signals for candidate-window generator
            "max_urgency": max_urgency,
            "min_due_days": min_due_days,
            # Will be enriched with capacity_trains_per_hr in api.py
            "capacity_trains_per_hr": 8,
        })
        group_counter += 1

    return grouped_blocks
