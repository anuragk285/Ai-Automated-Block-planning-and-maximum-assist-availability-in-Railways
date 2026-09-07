from typing import List, Dict, Any
import hashlib

# Traffic density profile: estimated fraction of daily train movements per hour band
# Used as a continuous disruption proxy even when per-section timetable data is sparse.
# Values roughly reflect Indian Railway peak/off-peak patterns.
HOURLY_TRAFFIC_DENSITY = {
    0: 0.15, 1: 0.08, 2: 0.06, 3: 0.06, 4: 0.08, 5: 0.18,
    6: 0.45, 7: 0.72, 8: 0.85, 9: 0.80, 10: 0.78, 11: 0.75,
    12: 0.80, 13: 0.78, 14: 0.75, 15: 0.72, 16: 0.75, 17: 0.88,
    18: 0.95, 19: 0.90, 20: 0.82, 21: 0.70, 22: 0.50, 23: 0.30,
}

def _section_hash_offset(section_code: str) -> float:
    """
    Computes a deterministic float offset [0, 4.0] from the section code hash.
    This spreads groups with otherwise identical costs across different sub-windows
    within the low-traffic band, ensuring unique start times even when timetable
    data is absent.
    """
    digest = int(hashlib.sha256(section_code.encode()).hexdigest(), 16)
    return (digest % 41) * 0.1  # 0.0, 0.1, ..., 4.0


def _base_traffic_disruption(start_hr: float, end_hr: float, capacity_trains_per_hr: int) -> float:
    """
    Computes a continuous traffic disruption score based on:
    - The hourly traffic density profile (independent of per-section timetable data)
    - The section's line capacity (higher capacity = more trains = higher raw disruption)
    - Duration of the block (longer blocks intercept more trains)
    """
    score = 0.0
    duration = end_hr - start_hr
    steps = max(1, int(duration * 4))  # Sample every 15 minutes
    step_size = duration / steps

    for k in range(steps):
        hr = start_hr + k * step_size
        hour_int = int(hr) % 24
        density = HOURLY_TRAFFIC_DENSITY.get(hour_int, 0.5)
        # Estimated trains blocked in this step = density * capacity * step_duration_hrs
        trains_blocked = density * capacity_trains_per_hr * step_size
        score += trains_blocked * 10.0  # Scale to 0–100 range

    return round(min(score, 100.0), 1)


def generate_candidate_windows(
    grouped_block: Dict[str, Any],
    timetables: List[Dict[str, Any]],
    ml_traffic_predict_func=None,
    step_hrs: float = 0.5,
    horizon_hrs: float = 24.0
) -> List[Dict[str, Any]]:
    """
    Generates potential time windows for a grouped block across the 24h planning horizon.

    Uses a two-layer disruption scoring strategy:
    1. PRIMARY: Actual timetable train counts for sections with timetable data.
    2. SECONDARY: Hourly traffic density profile heuristic for sections with no timetable
       coverage (e.g., synthetic STN-STN sections). This prevents all blocks from
       collapsing to the same time window due to all having zero timetable data.

    A section-specific hash offset ensures identical-priority sections are spread
    across different time slots even when disruption scores are equal.
    """
    duration = float(grouped_block.get("combined_duration_hrs", 2.0))
    sec_code = grouped_block.get("section_code", "")
    urgency = float(grouped_block.get("max_urgency", 3.0))  # Higher urgency → prefer earlier low-traffic windows

    # Section line capacity from grouping context (passed through from section metadata)
    capacity = int(grouped_block.get("capacity_trains_per_hr", 8))

    # Filter scheduled timetables for this specific track section
    sec_timetables = [tt for tt in timetables if tt.get("section_code") == sec_code]
    has_timetable_data = len(sec_timetables) > 0

    # Deterministic per-section offset to spread ties (0.0–4.0h within low-traffic band)
    sec_offset = _section_hash_offset(sec_code)

    candidates = []
    window_id_idx = 1

    current_start = 0.0
    while current_start + duration <= horizon_hrs:
        current_end = round(current_start + duration, 1)

        # ── PRIMARY: Timetable-based disruption count ──────────────────────────
        win_start_min = int(current_start * 60)
        win_end_min = int(current_end * 60)

        overlapping_trains = 0
        for tt in sec_timetables:
            t_entry = tt.get("scheduled_entry_min", 0)
            t_exit = tt.get("scheduled_exit_min", 0)
            if max(win_start_min, t_entry) < min(win_end_min, t_exit):
                overlapping_trains += 1

        # ── SECONDARY: Density-profile-based disruption (always applied) ──────
        density_disruption = _base_traffic_disruption(current_start, current_end, capacity)

        # ── Combine disruption signals ─────────────────────────────────────────
        if has_timetable_data:
            # Weight actual timetable counts heavily when data is available
            timetable_disruption = overlapping_trains * 12.0  # ~12 pts per overlapping train
            if ml_traffic_predict_func:
                timetable_disruption = ml_traffic_predict_func(
                    sec_code, current_start, current_end, overlapping_trains
                )
            disruption_score = timetable_disruption * 0.7 + density_disruption * 0.3
        else:
            # No timetable coverage: use density profile entirely
            disruption_score = density_disruption

        # ── Section-hash diversity offset within same-score windows ───────────
        # Add a tiny per-section tiebreak cost that shifts "optimal" windows by the
        # section-unique hash offset, ensuring different sections don't all land on 01:00.
        # This cost is too small to override real disruption differences (< 0.5 pts),
        # but breaks ties deterministically and spreads blocks across the horizon.
        tiebreak_cost = sec_offset * 0.01  # 0.00–0.04 pts — purely tie-breaking

        # ── Urgency preference: higher urgency prefers lower disruption windows ─
        # Mild amplification: urgency ≥ 4 gets 10% disruption bonus to compete harder for night windows
        urgency_factor = 1.0 + (urgency - 3.0) * 0.05  # Slight amplification for high urgency
        final_score = round((disruption_score + tiebreak_cost) * max(urgency_factor, 0.8), 2)

        candidates.append({
            "candidate_id": f"WIN_{grouped_block.get('group_id')}_{window_id_idx:02d}",
            "group_id": grouped_block.get("group_id"),
            "section_code": sec_code,
            "start_time_hr": round(current_start, 1),
            "end_time_hr": current_end,
            "duration_hrs": duration,
            "affected_trains_count": overlapping_trains,
            "predicted_disruption": final_score,
            "is_night_window": (0.0 <= current_start < 5.0),
            "combined_required_equipment": grouped_block.get("combined_required_equipment", []),
        })

        window_id_idx += 1
        current_start = round(current_start + step_hrs, 1)

    # Sort candidates by predicted disruption ascending (best window first)
    candidates.sort(key=lambda c: c["predicted_disruption"])
    return candidates
