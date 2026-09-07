import networkx as nx
from typing import List, Dict, Any
from app.pipeline.module12_track_rerouting import resolve_train_for_blocked_track

class NetworkImpactAnalyzer:
    """
    NetworkX-based Network Impact & Train Rerouting Analyzer.
    
    Evaluates network-wide congestion, alternate routing feasibility, and capacity limits
    when a track section/track is blocked for maintenance.
    """

    def __init__(self, stations: List[Dict[str, Any]], sections: List[Dict[str, Any]], alternate_routes: List[Dict[str, Any]] = None):
        self.stations = stations
        self.sections = sections
        self.sections_map = {s["code"]: s for s in sections}
        self.alternate_routes = alternate_routes or []
        self.graph = self._build_graph()

    def _build_graph(self) -> nx.Graph:
        """Construct NetworkX graph of railway network."""
        G = nx.Graph()

        for st in self.stations:
            G.add_node(st["code"], name=st.get("name"), schematic_x_position=st.get("schematic_x_position"), schematic_y_position=st.get("schematic_y_position"))

        for sec in self.sections:
            start = sec["start_station_code"]
            end = sec["end_station_code"]
            G.add_edge(
                start, end,
                code=sec["code"],
                length_km=float(sec["length_km"]),
                weight=float(sec["length_km"]),
                total_tracks=int(sec.get("total_tracks", 2)),
                capacity=int(sec.get("capacity_trains_per_hr", 6)),
                track_type=sec.get("track_type", "Double")
            )

        return G

    def analyze_block_impact(
        self,
        candidate_window: Dict[str, Any],
        timetables: List[Dict[str, Any]],
        trains: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Calculates network disruption score and alternate routing plans for trains affected by a block.
        """
        sec_code = candidate_window.get("section_code", "")
        blocked_track_num = candidate_window.get("target_track_number", 1)
        start_hr = candidate_window.get("start_time_hr", 0.0)
        end_hr = candidate_window.get("end_time_hr", 0.0)

        # Build tracks_map
        sec_info = self.sections_map.get(sec_code, {})
        num_tracks = sec_info.get("total_tracks", 2)
        tracks_list = [
            {"track_id": f"TRK_{sec_code}_{t}", "section_code": sec_code, "track_number": t, "health_status": "healthy"}
            for t in range(1, num_tracks + 1)
        ]
        tracks_map = {sec_code: tracks_list}

        win_start_min = int(start_hr * 60)
        win_end_min = int(end_hr * 60)

        train_map = {t["train_number"]: t for t in trains}
        affected_trains = []

        for tt in timetables:
            if tt.get("section_code") == sec_code:
                t_entry = tt.get("scheduled_entry_min", 0)
                t_exit = tt.get("scheduled_exit_min", 0)
                if max(win_start_min, t_entry) < min(win_end_min, t_exit):
                    tr_info = train_map.get(tt.get("train_number"), {})
                    if tr_info:
                        affected_trains.append(tr_info)

        # Unique affected trains
        unique_trains = {t["train_id"]: t for t in affected_trains}.values()

        rerouted_details = []
        same_track_reassignments = []
        unrouteable_details = []
        total_impact = 0.0

        for tr in unique_trains:
            resolution_res = resolve_train_for_blocked_track(
                train=tr,
                blocked_section_code=sec_code,
                blocked_track_number=blocked_track_num,
                start_time_hr=start_hr,
                end_time_hr=end_hr,
                sections_map=self.sections_map,
                tracks_map=tracks_map,
                network_graph=self.graph
            )

            total_impact += resolution_res["disruption_penalty"]

            if not resolution_res["is_rerouted"]:
                same_track_reassignments.append({
                    "train_id": tr["train_id"],
                    "train_number": tr["train_number"],
                    "train_name": tr.get("train_name"),
                    "resolution": resolution_res["resolution"]
                })
            elif resolution_res.get("has_viable_route", True):
                rerouted_details.append({
                    "train_id": tr["train_id"],
                    "train_number": tr["train_number"],
                    "train_name": tr.get("train_name"),
                    "resolution": resolution_res["resolution"],
                    "assigned_path": resolution_res["assigned_path"],
                    "skipped_stations": resolution_res["skipped_stations"]
                })
            else:
                unrouteable_details.append({
                    "train_id": tr["train_id"],
                    "train_number": tr["train_number"],
                    "train_name": tr.get("train_name"),
                    "resolution": resolution_res["resolution"]
                })

        network_score = round(total_impact, 1)

        return {
            "section_code": sec_code,
            "target_track_number": blocked_track_num,
            "affected_train_count": len(unique_trains),
            "same_track_reassignments": same_track_reassignments,
            "rerouted_trains": rerouted_details,
            "unrouteable_trains": unrouteable_details,
            "network_disruption_score": network_score,
            "explanation": f"{len(same_track_reassignments)} train(s) reassigned to same-section healthy track; {len(rerouted_details)} rerouted via alternate path."
        }
