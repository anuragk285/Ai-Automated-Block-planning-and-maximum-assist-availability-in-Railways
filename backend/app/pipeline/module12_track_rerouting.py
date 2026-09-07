import networkx as nx
from typing import List, Dict, Any, Optional

def format_min_to_24h(minutes: int) -> str:
    """Helper to convert minutes from midnight (0..1439) into 'HH:MM' 24hr string."""
    m = minutes % 1440
    hrs = m // 60
    mins = m % 60
    return f"{hrs:02d}:{mins:02d}"

def resolve_train_for_blocked_track(
    train: Dict[str, Any],
    blocked_section_code: str,
    blocked_track_number: int,
    start_time_hr: float,
    end_time_hr: float,
    sections_map: Dict[str, Dict[str, Any]],
    tracks_map: Dict[str, List[Dict[str, Any]]],
    network_graph: nx.Graph
) -> Dict[str, Any]:
    """
    Rerouting Decision Engine for Indian Railways Track Maintenance.
    
    STEP 1: Check if section has another healthy track. If yes, reassign to same section healthy track.
            Path is UNCHANGED, assigned_path stays None.
    STEP 2: Single-track section or all tracks blocked -> Find alternate graph paths.
            Rank candidates primarily by MINIMIZING SKIPPED STATIONS.
            Break ties by shortest network disruption/distance.
    """
    sec_info = sections_map.get(blocked_section_code, {})
    total_tracks = sec_info.get("total_tracks", 2)
    sec_tracks = tracks_map.get(blocked_section_code, [])

    # Find healthy tracks in this section
    healthy_tracks = [
        t for t in sec_tracks
        if t["track_number"] != blocked_track_number and t.get("health_status", "healthy") == "healthy"
    ]

    # STEP 1: Same-section alternate track
    if total_tracks > 1 and healthy_tracks:
        selected_track_num = healthy_tracks[0]["track_number"]
        return {
            "train_id": train.get("train_id"),
            "train_number": train.get("train_number"),
            "resolution": f"Reassigned to Track {selected_track_num} (same section {blocked_section_code})",
            "is_rerouted": False,
            "assigned_track_number": selected_track_num,
            "assigned_path": None,
            "skipped_stations": [],
            "disruption_penalty": 0.5 # Minimal disruption penalty for same-track swap
        }

    # STEP 2: Single-track section or all tracks blocked -> Real Reroute Search
    original_stops = train.get("original_path", [])
    if not original_stops:
        return {
            "train_id": train.get("train_id"),
            "train_number": train.get("train_number"),
            "resolution": "No original path defined for train",
            "is_rerouted": False,
            "assigned_path": None,
            "skipped_stations": [],
            "disruption_penalty": 0.0
        }

    u_blocked = sec_info.get("start_station_code")
    v_blocked = sec_info.get("end_station_code")

    if not u_blocked or not v_blocked:
        return {
            "train_id": train.get("train_id"),
            "train_number": train.get("train_number"),
            "resolution": "Invalid section station endpoints",
            "is_rerouted": False,
            "assigned_path": None,
            "skipped_stations": [],
            "disruption_penalty": 0.0
        }

    # Create bypass graph excluding blocked section edge
    bypass_graph = network_graph.copy()
    if bypass_graph.has_edge(u_blocked, v_blocked):
        bypass_graph.remove_edge(u_blocked, v_blocked)

    # Find all simple paths between u_blocked and v_blocked up to cutoff
    original_station_codes = [stop.get("station_code") for stop in original_stops]

    try:
        candidate_paths = list(nx.all_simple_paths(bypass_graph, source=u_blocked, target=v_blocked, cutoff=6))
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        candidate_paths = []

    if not candidate_paths:
        return {
            "train_id": train.get("train_id"),
            "train_number": train.get("train_number"),
            "resolution": f"NO VIABLE ROUTE -- Section {blocked_section_code} completely isolated during window",
            "is_rerouted": True,
            "has_viable_route": False,
            "assigned_path": None,
            "skipped_stations": original_station_codes,
            "disruption_penalty": 120.0 # Heavy unrouteable penalty
        }

    # Evaluate candidate alternate paths
    evaluated_candidates = []
    for cand_path in candidate_paths:
        # Calculate skipped stations: original stations NOT in candidate path
        cand_set = set(cand_path)
        skipped = [code for code in original_station_codes if code not in cand_set and code != u_blocked and code != v_blocked]
        
        # Calculate path distance
        path_length = 0.0
        for i in range(len(cand_path) - 1):
            if bypass_graph.has_edge(cand_path[i], cand_path[i+1]):
                path_length += bypass_graph[cand_path[i]][cand_path[i+1]].get("length_km", 10.0)

        evaluated_candidates.append({
            "path_stations": cand_path,
            "skipped_stations": skipped,
            "skipped_count": len(skipped),
            "distance_km": path_length
        })

    # PRIMARY CRITERION: Sort candidates to MINIMIZE skipped_count. Tie break by distance_km.
    evaluated_candidates.sort(key=lambda c: (c["skipped_count"], c["distance_km"]))

    best_candidate = evaluated_candidates[0]
    best_path_codes = best_candidate["path_stations"]
    skipped_list = best_candidate["skipped_stations"]

    # Construct new assigned_path with scheduled times
    assigned_path_stops = []
    base_time_min = int(start_time_hr * 60)
    
    for idx, st_code in enumerate(best_path_codes):
        stop_time = format_min_to_24h(base_time_min + idx * 25)
        assigned_path_stops.append({
            "station_code": st_code,
            "scheduled_time": stop_time,
            "is_bypass": (st_code not in original_station_codes)
        })

    # Rerouting penalty score: 15.0 per skipped station + distance penalty
    disruption_penalty = round(len(skipped_list) * 15.0 + best_candidate["distance_km"] * 0.3, 1)

    return {
        "train_id": train.get("train_id"),
        "train_number": train.get("train_number"),
        "resolution": f"Rerouted via alternate path {' -> '.join(best_path_codes)} -- {len(skipped_list)} station(s) skipped: {', '.join(skipped_list) if skipped_list else 'None'}",
        "is_rerouted": True,
        "has_viable_route": True,
        "assigned_track_number": None,
        "assigned_path": assigned_path_stops,
        "skipped_stations": skipped_list,
        "disruption_penalty": disruption_penalty
    }
