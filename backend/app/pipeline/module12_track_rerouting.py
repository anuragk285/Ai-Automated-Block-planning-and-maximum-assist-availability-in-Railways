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


def compute_rerouted_path_for_train(
    train: Dict[str, Any],
    from_station_code: str,
    to_station_code: str,
    network_graph: nx.Graph,
    base_departure_time: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Computes an alternate routing path for a train affected by a block section
    between from_station_code and to_station_code.
    Avoids the direct blocked segment in network_graph and re-sequences the train's route.
    """
    original_stops = train.get("original_path", [])
    if not original_stops:
        return None

    orig_station_codes = []
    for item in original_stops:
        if isinstance(item, dict) and "station_code" in item:
            orig_station_codes.append(str(item["station_code"]).upper())
        elif isinstance(item, str):
            orig_station_codes.append(item.upper())

    from_u = from_station_code.upper()
    to_u = to_station_code.upper()

    if from_u not in orig_station_codes or to_u not in orig_station_codes:
        return None

    try:
        idx_from = orig_station_codes.index(from_u)
        idx_to = orig_station_codes.index(to_u)
    except ValueError:
        return None

    if idx_from >= idx_to:
        return None

    # Construct bypass graph with the blocked edge/segment removed
    bypass_graph = network_graph.copy()
    if bypass_graph.has_edge(from_u, to_u):
        bypass_graph.remove_edge(from_u, to_u)

    # Also remove any intermediate consecutive edges on the blocked segment
    for k in range(idx_from, idx_to):
        u_k, v_k = orig_station_codes[k], orig_station_codes[k + 1]
        if bypass_graph.has_edge(u_k, v_k):
            bypass_graph.remove_edge(u_k, v_k)

    origin = orig_station_codes[0]
    destination = orig_station_codes[-1]

    # 1. First priority: compute a coherent, continuous path from origin to destination on the bypass graph
    new_station_codes = None
    try:
        new_station_codes = nx.shortest_path(bypass_graph, source=origin, target=destination, weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        # 2. Fallback: try finding a bypass from from_u to a downstream station on the train's route
        for j in range(len(orig_station_codes) - 1, idx_to, -1):
            downstream_stn = orig_station_codes[j]
            try:
                subpath = nx.shortest_path(bypass_graph, source=from_u, target=downstream_stn, weight="weight")
                candidate = orig_station_codes[:idx_from] + subpath + orig_station_codes[j + 1:]
                # Check that candidate has no duplicate stations (no looping)
                if len(candidate) == len(set(candidate)):
                    new_station_codes = candidate
                    break
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                continue

    if not new_station_codes or len(new_station_codes) < 2:
        return None

    # Graph validity check: every consecutive pair must have a real edge in network_graph
    for i in range(len(new_station_codes) - 1):
        u, v = new_station_codes[i], new_station_codes[i + 1]
        if not network_graph.has_edge(u, v):
            return None

    # Canonical base departure time: ALWAYS use the train's scheduled departure time
    dep_str = train.get("scheduled_departure_time") or "06:00"
    try:
        parts = dep_str.split(":")
        start_min = int(parts[0]) * 60 + int(parts[1])
    except Exception:
        start_min = 360

    # Build assigned_path stops with consistent chronological progression
    assigned_path_stops = []
    current_time_min = start_min
    for idx, st_code in enumerate(new_station_codes):
        if idx > 0:
            u, v = new_station_codes[idx - 1], st_code
            edge_data = network_graph.get_edge_data(u, v) or {}
            length_km = float(edge_data.get("length_km", 20.0))
            # Average speed ~60 km/h -> 1 min per km, minimum 15 mins
            hop_duration = max(15, int(length_km))
            current_time_min += hop_duration

        stop_time = format_min_to_24h(current_time_min)
        assigned_path_stops.append({
            "station_code": st_code,
            "scheduled_time": stop_time,
            "is_bypass": (st_code not in orig_station_codes)
        })

    skipped = [c for c in orig_station_codes if c not in new_station_codes]

    return {
        "train_id": train.get("train_id"),
        "train_number": train.get("train_number"),
        "is_rerouted": True,
        "current_status": "rerouted",
        "assigned_path": assigned_path_stops,
        "scheduled_departure_time": assigned_path_stops[0]["scheduled_time"],
        "scheduled_arrival_time": assigned_path_stops[-1]["scheduled_time"],
        "skipped_stations": skipped,
        "resolution": f"Rerouted via alternate path {' -> '.join(new_station_codes)}"
    }

