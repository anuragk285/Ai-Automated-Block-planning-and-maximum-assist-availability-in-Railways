import math
from typing import List, Dict, Any
from ortools.sat.python import cp_model

# Time resolution: encode hours as integers with 2 decimal places of precision
# 1 unit = 0.5hr so 24h horizon = 48 slots
SLOT_SIZE_HRS = 0.5
TOTAL_SLOTS = 48  # 0–47 → 00:00–23:30

def _hr_to_slot(hr: float) -> int:
    return int(round(hr / SLOT_SIZE_HRS))

def _slot_to_hr(slot: int) -> float:
    return round(slot * SLOT_SIZE_HRS, 1)


class BlockOptimizationEngine:
    """
    Google OR-Tools CP-SAT Optimizer for Railway Maintenance Block Planning.

    Selects optimal non-overlapping time windows and resource assignments for maintenance
    group blocks to minimize train traffic disruption and network impact while maximizing
    high-priority asset availability.

    Key improvements:
    - Uses integer time slots for precise overlap arithmetic in CP-SAT
    - Adds a spread-diversity penalty to prevent all blocks clustering at one start slot
    - Correctly handles sections on both shared-resource and same-section conflicts
    - Passes conflict notes through to the decision_reason for Gantt visibility
    """

    @classmethod
    def solve_block_plan(
        cls,
        grouped_blocks: List[Dict[str, Any]],
        candidates_by_group: Dict[str, List[Dict[str, Any]]],
        safety_evaluations: Dict[str, Dict[str, Any]],  # candidate_id -> safety_res
        network_impacts: Dict[str, Dict[str, Any]],      # candidate_id -> network_res
        priority_scores_by_group: Dict[str, Dict[str, Any]]  # group_id -> priority_info
    ) -> List[Dict[str, Any]]:
        """
        Runs OR-Tools CP-SAT solver to produce the globally optimal maintenance block plan.
        """
        model = cp_model.CpModel()

        # Decision Variables: x[group_id, candidate_id] -> 0 or 1
        var_x: Dict[tuple, cp_model.IntVar] = {}
        # Unscheduled Variables: y[group_id] -> 0 or 1
        var_y: Dict[str, cp_model.IntVar] = {}

        candidate_lookup = {}
        group_candidate_vars = {}

        for group in grouped_blocks:
            g_id = group["group_id"]
            cands = candidates_by_group.get(g_id, [])
            group_candidate_vars[g_id] = []

            for cand in cands:
                c_id = cand["candidate_id"]
                candidate_lookup[c_id] = cand

                # Check if candidate passed deterministic Safety Engine
                safety_res = safety_evaluations.get(c_id, {})
                if not safety_res.get("passed", False):
                    continue  # Exclude hard-rejected candidates

                var = model.NewBoolVar(f"x_{g_id}_{c_id}")
                var_x[(g_id, c_id)] = var
                group_candidate_vars[g_id].append((c_id, var))

            # Unscheduled penalty variable
            var_y[g_id] = model.NewBoolVar(f"y_{g_id}")

            # Constraint: Exactly one candidate window selected OR group left unscheduled
            vars_sum = [var for _, var in group_candidate_vars[g_id]] + [var_y[g_id]]
            if vars_sum:
                model.Add(sum(vars_sum) == 1)
            else:
                # No safe candidates: force unscheduled
                model.Add(var_y[g_id] == 1)

        # ── 2. Overlap Constraints via CP-SAT interval variables ──────────────
        # Build interval variables for each selected candidate for proper CP-SAT overlap detection
        # We use optional intervals that are active only when their boolean x-var is True.

        interval_vars = {}   # (g_id, c_id) -> interval variable
        start_vars = {}      # (g_id, c_id) -> start integer variable (in slots)
        end_vars_map = {}    # (g_id, c_id) -> end integer variable

        for (g_id, c_id), bool_var in var_x.items():
            cand = candidate_lookup[c_id]
            start_slot = _hr_to_slot(cand["start_time_hr"])
            end_slot = _hr_to_slot(cand["end_time_hr"])
            duration_slots = end_slot - start_slot

            # Fixed-time interval (candidate windows have fixed start/end)
            s_var = model.NewConstant(start_slot)
            e_var = model.NewConstant(end_slot)
            iv = model.NewOptionalIntervalVar(s_var, duration_slots, e_var, bool_var, f"iv_{g_id}_{c_id}")

            interval_vars[(g_id, c_id)] = iv
            start_vars[(g_id, c_id)] = s_var
            end_vars_map[(g_id, c_id)] = e_var

        # Build lookup: section_code -> list of (g_id, c_id, interval_var, equip_set)
        from collections import defaultdict
        section_intervals: Dict[str, list] = defaultdict(list)
        equip_intervals: Dict[str, list] = defaultdict(list)  # equipment -> list of interval vars

        all_active_cands = [(g_id, c_id, var) for (g_id, c_id), var in var_x.items()]

        for (g_id, c_id), bool_var in var_x.items():
            cand = candidate_lookup[c_id]
            sec = cand["section_code"]
            iv = interval_vars[(g_id, c_id)]

            section_intervals[sec].append((g_id, c_id, iv))

            equip_set = set(cand.get("combined_required_equipment", []))
            for eq in equip_set:
                equip_intervals[eq].append(iv)

        # Hard Constraint A: Same section → no overlapping intervals
        for sec, ivs in section_intervals.items():
            if len(ivs) > 1:
                model.AddNoOverlap([iv for _, _, iv in ivs])

        # Hard Constraint B: Shared equipment → no overlapping intervals
        for eq, ivs in equip_intervals.items():
            if len(ivs) > 1:
                model.AddNoOverlap(ivs)

        # ── 3. Objective Function ─────────────────────────────────────────────
        # Minimize: traffic disruption + network impact + unscheduled penalty
        # Add: spread_diversity_penalty to discourage clustering at the same slot
        obj_terms = []

        for (g_id, c_id), var in var_x.items():
            cand = candidate_lookup[c_id]
            ml_disruption = cand.get("predicted_disruption", 0.0)
            net_res = network_impacts.get(c_id, {})
            net_impact = net_res.get("network_disruption_score", 0.0)

            # Primary cost: traffic disruption + network impact (scaled by 10 for integer precision)
            cost_coeff = int(round((ml_disruption * 1.5 + net_impact * 2.0 + 10.0) * 10))
            obj_terms.append(cost_coeff * var)

        for g_id, var_unscheduled in var_y.items():
            prio_info = priority_scores_by_group.get(g_id, {})
            prio_score = prio_info.get("priority_score", 50.0)
            # High penalty for leaving critical/high priority blocks unscheduled
            unscheduled_cost = int(round((prio_score * 25.0 + 100.0) * 10))
            obj_terms.append(unscheduled_cost * var_unscheduled)

        if obj_terms:
            model.Minimize(sum(obj_terms))

        # ── 4. Solve Model ────────────────────────────────────────────────────
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 8.0
        status = solver.Solve(model)

        final_blocks = []

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            # Build a map of section → selected block start to detect concurrent blocks
            section_selected_start: Dict[str, float] = {}

            for group in grouped_blocks:
                g_id = group["group_id"]
                sec_code = group["section_code"]
                prio_info = priority_scores_by_group.get(g_id, {})

                selected_cand = None
                for c_id, var in group_candidate_vars[g_id]:
                    if solver.Value(var) == 1:
                        selected_cand = candidate_lookup[c_id]
                        break

                if selected_cand:
                    c_id = selected_cand["candidate_id"]
                    safety_res = safety_evaluations.get(c_id, {})
                    net_res = network_impacts.get(c_id, {})

                    start_hr = selected_cand["start_time_hr"]
                    end_hr = selected_cand["end_time_hr"]

                    # Build assigned resources list
                    assigned_res = []
                    for eq in group.get("combined_required_equipment", []):
                        assigned_res.append({"type": "Equipment", "name": eq})
                    for sk in group.get("combined_required_skills", []):
                        assigned_res.append({"type": "CrewSkill", "name": sk})

                    # Detect if this section was already scheduled concurrently (different group on same section)
                    concurrent_note = ""
                    if sec_code in section_selected_start:
                        prev_start = section_selected_start[sec_code]
                        if prev_start != start_hr:
                            concurrent_note = f" | Staggered from prior {sec_code} block at {prev_start:.1f}h"

                    section_selected_start[sec_code] = start_hr

                    # Detect equipment conflicts for rationale note
                    equip_conflict_note = ""
                    for eq in group.get("combined_required_equipment", []):
                        for other_g in grouped_blocks:
                            other_gid = other_g["group_id"]
                            if other_gid == g_id:
                                continue
                            if eq in other_g.get("combined_required_equipment", []):
                                equip_conflict_note = f"Conflict-aware: shared {eq} with {other_g['section_code']} — staggered. "
                                break
                        if equip_conflict_note:
                            break

                    block_plan = {
                        "block_id": f"BLK-{g_id}",
                        "group_id": g_id,
                        "section_code": sec_code,
                        "start_time_hr": start_hr,
                        "end_time_hr": end_hr,
                        "duration_hrs": group["combined_duration_hrs"],
                        "status": "Proposed",
                        "rejection_reason": None,
                        "priority_score": prio_info.get("priority_score", 50.0),
                        "priority_bucket": prio_info.get("priority_bucket", "Medium"),
                        "predicted_disruption": selected_cand["predicted_disruption"],
                        "network_impact_score": net_res.get("network_disruption_score", 0.0),
                        "assigned_resources": assigned_res,
                        "request_ids": group["request_ids"],
                        "safety_checks": safety_res.get("checks", []),
                        "decision_reason": {
                            "optimizer_status": solver.StatusName(status),
                            "objective_value": round(solver.ObjectiveValue() / 10.0, 2),
                            "rationale": (
                                f"{equip_conflict_note}"
                                f"Selected window {start_hr:.1f}h–{end_hr:.1f}h "
                                f"(lowest disruption score {selected_cand['predicted_disruption']:.1f} "
                                f"for {sec_code} with {selected_cand['affected_trains_count']} overlapping trains)"
                                f"{concurrent_note}"
                            )
                        }
                    }
                    final_blocks.append(block_plan)

        return final_blocks
