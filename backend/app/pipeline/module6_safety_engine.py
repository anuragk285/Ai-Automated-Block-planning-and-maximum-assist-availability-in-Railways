from typing import List, Dict, Any

class SafetyConstraintEngine:
    """
    Deterministic Safety & Constraint Engine for Indian Railways Block Planning.
    
    CRITICAL MANDATE:
    This module contains NO ML or probabilistic models.
    Safety constraints are hard rules evaluated deterministically.
    Any violation results in a HARD REJECT with machine-readable reasons.
    """

    MAX_RAINFALL_FOR_OUTDOOR_WORK_MM = 20.0
    MAX_WIND_SPEED_FOR_OHE_KMH = 35.0

    @classmethod
    def validate_candidate_block(
        cls,
        candidate_window: Dict[str, Any],
        grouped_requests: List[Dict[str, Any]],
        available_resources: List[Dict[str, Any]],
        weather_forecast: Dict[str, Any],
        existing_scheduled_blocks: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Validates a candidate block window against hard safety and resource constraints.
        """
        if existing_scheduled_blocks is None:
            existing_scheduled_blocks = []

        start_hr = candidate_window.get("start_time_hr", 0.0)
        end_hr = candidate_window.get("end_time_hr", 0.0)
        section_code = candidate_window.get("section_code", "")

        checks_summary = []
        violations = []

        # 1. Skill & Crew Availability Check
        required_skills = set()
        for req in grouped_requests:
            for skill in req.get("required_skills", []):
                required_skills.add(skill)

        available_crew_skills = set()
        for res in available_resources:
            if res.get("resource_type") == "Crew":
                # Check shift availability window
                if res.get("available_start_hr", 0.0) <= start_hr and res.get("available_end_hr", 24.0) >= end_hr:
                    available_crew_skills.add(res.get("skill_or_type"))

        missing_skills = required_skills - available_crew_skills
        if missing_skills:
            violations.append(f"Missing qualified crew for required skills: {list(missing_skills)}")
            checks_summary.append({
                "check_name": "CHECK_WORKER_SKILLS",
                "passed": False,
                "message": f"Unsatisfied crew skills: {list(missing_skills)}"
            })
        else:
            checks_summary.append({
                "check_name": "CHECK_WORKER_SKILLS",
                "passed": True,
                "message": f"All required skills satisfied: {list(required_skills)}"
            })

        # 2. Machinery & Equipment Availability Check
        required_equipment = set()
        for req in grouped_requests:
            for equip in req.get("required_equipment", []):
                required_equipment.add(equip)

        available_equip_types = set()
        for res in available_resources:
            if res.get("resource_type") == "Equipment":
                if res.get("available_start_hr", 0.0) <= start_hr and res.get("available_end_hr", 24.0) >= end_hr:
                    available_equip_types.add(res.get("skill_or_type"))

        missing_equipment = required_equipment - available_equip_types
        if missing_equipment:
            violations.append(f"Required equipment unavailable in time window: {list(missing_equipment)}")
            checks_summary.append({
                "check_name": "CHECK_EQUIPMENT_AVAILABILITY",
                "passed": False,
                "message": f"Missing equipment: {list(missing_equipment)}"
            })
        else:
            checks_summary.append({
                "check_name": "CHECK_EQUIPMENT_AVAILABILITY",
                "passed": True,
                "message": f"All required equipment available: {list(required_equipment)}"
            })

        # 3. Weather Safety Limits Check
        rainfall = weather_forecast.get("rainfall_mm", 0.0)
        wind_speed = weather_forecast.get("wind_speed_kmh", 0.0)
        is_ohe_work = any(req.get("department") == "TRAC" for req in grouped_requests)

        weather_violated = False
        weather_msg = "Weather conditions within safe operational limits."
        if rainfall > cls.MAX_RAINFALL_FOR_OUTDOOR_WORK_MM:
            weather_violated = True
            weather_msg = f"Heavy rainfall ({rainfall}mm > {cls.MAX_RAINFALL_FOR_OUTDOOR_WORK_MM}mm limit) prevents track maintenance."
        elif is_ohe_work and wind_speed > cls.MAX_WIND_SPEED_FOR_OHE_KMH:
            weather_violated = True
            weather_msg = f"High wind speed ({wind_speed}km/h > {cls.MAX_WIND_SPEED_FOR_OHE_KMH}km/h limit) prohibits high-voltage OHE overhead work."

        if weather_violated:
            violations.append(weather_msg)
            checks_summary.append({
                "check_name": "CHECK_WEATHER_RESTRICTIONS",
                "passed": False,
                "message": weather_msg
            })
        else:
            checks_summary.append({
                "check_name": "CHECK_WEATHER_RESTRICTIONS",
                "passed": True,
                "message": weather_msg
            })

        # 4. Task Dependency Ordering Check
        req_ids_in_block = {req.get("request_id") for req in grouped_requests}
        dependency_violated = False
        dep_msg = "All task dependencies satisfied."
        for req in grouped_requests:
            deps = req.get("dependencies", [])
            for dep_id in deps:
                # If dependency is not in this block, check if it was completed earlier
                if dep_id not in req_ids_in_block:
                    # Check existing scheduled blocks
                    dep_completed = any(
                        dep_id in block.get("request_ids", []) and block.get("end_time_hr", 24.0) <= start_hr
                        for block in existing_scheduled_blocks
                    )
                    if not dep_completed:
                        dependency_violated = True
                        dep_msg = f"Request {req.get('request_id')} depends on unfulfilled antecedent request {dep_id}."
                        break

        if dependency_violated:
            violations.append(dep_msg)
            checks_summary.append({
                "check_name": "CHECK_DEPENDENCY_ORDERING",
                "passed": False,
                "message": dep_msg
            })
        else:
            checks_summary.append({
                "check_name": "CHECK_DEPENDENCY_ORDERING",
                "passed": True,
                "message": dep_msg
            })

        # 5. Overlap Conflict Check with Existing Scheduled Blocks on Same Section
        section_conflict = False
        section_msg = f"No track occupation overlap on section {section_code}."
        for ex_block in existing_scheduled_blocks:
            if ex_block.get("section_code") == section_code and ex_block.get("status") == "Approved":
                ex_start = ex_block.get("start_time_hr", 0.0)
                ex_end = ex_block.get("end_time_hr", 0.0)
                # Overlap test: max(start1, start2) < min(end1, end2)
                if max(start_hr, ex_start) < min(end_hr, ex_end):
                    section_conflict = True
                    section_msg = f"Time window overlap ({start_hr:.1f}h - {end_hr:.1f}h) with already approved block ({ex_start:.1f}h - {ex_end:.1f}h) on {section_code}."
                    break

        if section_conflict:
            violations.append(section_msg)
            checks_summary.append({
                "check_name": "CHECK_SECTION_OCCUPATION_OVERLAP",
                "passed": False,
                "message": section_msg
            })
        else:
            checks_summary.append({
                "check_name": "CHECK_SECTION_OCCUPATION_OVERLAP",
                "passed": True,
                "message": section_msg
            })

        # 6. Proximity & Shared Resource Safety Check with Existing Scheduled Blocks
        # Multiple blocks cannot be active at the same time in nearby/adjacent areas
        # (workers/crew cannot operate in multiple nearby locations at the same time).
        proximity_conflict = False
        proximity_msg = "No nearby spatial or concurrent resource conflicts detected."

        cand_stns = set(section_code.replace("SEC_", "").split("_")) if section_code else set()

        for ex_block in existing_scheduled_blocks:
            if ex_block.get("status") != "Approved":
                continue

            ex_sec = ex_block.get("section_code", "")
            if not ex_sec or ex_sec == section_code:
                # Same section is handled by CHECK_SECTION_OCCUPATION_OVERLAP
                continue

            ex_start = ex_block.get("start_time_hr", 0.0)
            ex_end = ex_block.get("end_time_hr", 0.0)

            # Check time overlap: max(start1, start2) < min(end1, end2)
            if max(start_hr, ex_start) < min(end_hr, ex_end):
                ex_stns = set(ex_sec.replace("SEC_", "").split("_"))

                # Check if sections share a station node (adjacent sections)
                if cand_stns and ex_stns and cand_stns.intersection(ex_stns):
                    proximity_conflict = True
                    shared_hub = list(cand_stns.intersection(ex_stns))[0]
                    proximity_msg = (
                        f"Proximity Safety Constraint Violated: Concurrent block scheduled on adjacent section ({ex_sec}) "
                        f"around hub {shared_hub} during overlapping window ({ex_start:.1f}h - {ex_end:.1f}h). "
                        f"Crew/workers cannot execute simultaneous blocks in adjacent locations."
                    )
                    break

        if proximity_conflict:
            violations.append(proximity_msg)
            checks_summary.append({
                "check_name": "CHECK_PROXIMITY_RESOURCE_SAFETY",
                "passed": False,
                "message": proximity_msg
            })
        else:
            checks_summary.append({
                "check_name": "CHECK_PROXIMITY_RESOURCE_SAFETY",
                "passed": True,
                "message": proximity_msg
            })

        overall_passed = (len(violations) == 0)

        return {
            "passed": overall_passed,
            "checks": checks_summary,
            "violation_reasons": violations,
            "hard_reject": not overall_passed
        }

