import json
from typing import List, Dict, Any, Optional
import networkx as nx
from sqlalchemy.orm import Session
from app.data_access.base import DataSource
from app.models.db_models import (
    Station, Section, Track, AlternateRoute, Train, Timetable,
    MaintenanceRequest, AssetCondition, Resource, WeatherForecast, BlockSection
)
from app.pipeline.module12_track_rerouting import compute_rerouted_path_for_train

class DBSource(DataSource):
    """Concrete DataSource implementation backed by SQLAlchemy relational DB."""

    def __init__(self, db_session: Session):
        self.db = db_session

    def get_stations(self) -> List[Dict[str, Any]]:
        stations = self.db.query(Station).all()
        return [
            {
                "code": s.code,
                "name": s.name,
                "zone": s.zone,
                "schematic_x_position": s.schematic_x_position,
                "schematic_y_position": s.schematic_y_position,
            }
            for s in stations
        ]

    def get_sections(self) -> List[Dict[str, Any]]:
        sections = self.db.query(Section).all()
        return [
            {
                "code": s.code,
                "start_station_code": s.start_station_code,
                "end_station_code": s.end_station_code,
                "length_km": s.length_km,
                "track_type": s.track_type,
                "total_tracks": s.total_tracks,
                "capacity_trains_per_hr": s.capacity_trains_per_hr,
                "max_speed_kmh": s.max_speed_kmh,
            }
            for s in sections
        ]

    def get_tracks(self) -> List[Dict[str, Any]]:
        tracks = self.db.query(Track).all()
        return [
            {
                "track_id": t.track_id,
                "section_code": t.section_code,
                "track_number": t.track_number,
                "health_status": t.health_status,
                "direction": t.direction,
            }
            for t in tracks
        ]

    def get_alternate_routes(self) -> List[Dict[str, Any]]:
        routes = self.db.query(AlternateRoute).all()
        return [
            {
                "source_station_code": r.source_station_code,
                "target_station_code": r.target_station_code,
                "via_stations": json.loads(r.via_stations_json or "[]"),
                "additional_distance_km": r.additional_distance_km,
                "capacity_trains_per_hr": r.capacity_trains_per_hr,
            }
            for r in routes
        ]

    def get_trains(self, status: Optional[str] = None, train_type: Optional[str] = None) -> List[Dict[str, Any]]:
        query = self.db.query(Train)
        if status and status.upper() != "ALL":
            if status.lower() == "rerouted":
                query = query.filter((Train.current_status == "rerouted") | (Train.assigned_path_json.isnot(None)))
            else:
                query = query.filter_by(current_status=status.lower())
        if train_type and train_type.upper() != "ALL":
            query = query.filter_by(train_type=train_type)
            
        trains = query.order_by(Train.scheduled_departure_time).all()
        return [self._format_train_dict(t) for t in trains]

    def get_train_by_id(self, train_id: str) -> Optional[Dict[str, Any]]:
        train = self.db.query(Train).filter(
            (Train.train_id == train_id) | (Train.train_number == train_id)
        ).first()
        if not train:
            return None
        return self._format_train_dict(train)

    def _format_train_dict(self, t: Train) -> Dict[str, Any]:
        return {
            "train_id": t.train_id,
            "train_number": t.train_number,
            "train_name": t.train_name,
            "train_type": t.train_type,
            "priority_class": t.priority_class,
            "origin_station_code": t.origin_station_code,
            "destination_station_code": t.destination_station_code,
            "scheduled_departure_time": t.scheduled_departure_time,
            "scheduled_arrival_time": t.scheduled_arrival_time,
            "current_status": t.current_status,
            "current_section_code": t.current_section_code,
            "original_path": json.loads(t.original_path_json or "[]"),
            "assigned_path": json.loads(t.assigned_path_json) if t.assigned_path_json else None,
        }

    def get_timetables(self) -> List[Dict[str, Any]]:
        timetables = self.db.query(Timetable).all()
        return [
            {
                "train_number": tt.train_number,
                "section_code": tt.section_code,
                "scheduled_entry_min": tt.scheduled_entry_min,
                "scheduled_exit_min": tt.scheduled_exit_min,
                "actual_entry_min": tt.actual_entry_min,
                "actual_exit_min": tt.actual_exit_min,
                "is_delayed": tt.is_delayed,
                "delay_min": tt.delay_min,
            }
            for tt in timetables
        ]

    def get_maintenance_requests(self) -> List[Dict[str, Any]]:
        reqs = self.db.query(MaintenanceRequest).all()
        return [
            {
                "request_id": r.request_id,
                "department": r.department,
                "section_code": r.section_code,
                "target_track_number": r.target_track_number,
                "location_km": r.location_km,
                "defect_type": r.defect_type,
                "requested_duration_hours": r.requested_duration_hours,
                "declared_urgency": r.declared_urgency,
                "due_date_days": r.due_date_days,
                "dependencies": json.loads(r.dependencies_json or "[]"),
                "required_skills": json.loads(r.required_skills_json or "[]"),
                "required_equipment": json.loads(r.required_equipment_json or "[]"),
                "status": r.status,
            }
            for r in reqs
        ]

    def get_asset_conditions(self) -> List[Dict[str, Any]]:
        conds = self.db.query(AssetCondition).all()
        return [
            {
                "section_code": c.section_code,
                "track_wear_mm": c.track_wear_mm,
                "catenary_wear_pct": c.catenary_wear_pct,
                "signal_fault_frequency": c.signal_fault_frequency,
                "ballast_compaction_pct": c.ballast_compaction_pct,
                "joint_temperature_celsius": c.joint_temperature_celsius,
                "inspection_date": c.inspection_date,
            }
            for c in conds
        ]

    def get_resources(self) -> List[Dict[str, Any]]:
        resources = self.db.query(Resource).all()
        return [
            {
                "resource_id": res.resource_id,
                "resource_type": res.resource_type,
                "name": res.name,
                "department": res.department,
                "skill_or_type": res.skill_or_type,
                "total_count": res.total_count,
                "available_start_hr": res.available_start_hr,
                "available_end_hr": res.available_end_hr,
            }
            for res in resources
        ]

    def get_weather_forecast(self) -> Dict[str, Any]:
        wf = self.db.query(WeatherForecast).filter_by(day_offset=0).first()
        if not wf:
            return {"temperature_celsius": 30.0, "rainfall_mm": 0.0, "wind_speed_kmh": 10.0, "risk_level": "Low"}
        return {
            "temperature_celsius": wf.temperature_celsius,
            "rainfall_mm": wf.rainfall_mm,
            "wind_speed_kmh": wf.wind_speed_kmh,
            "risk_level": wf.risk_level,
        }

    def add_train(self, train_data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert and commit new train record into database."""
        original_path = train_data.get("original_path_json")
        assigned_path = train_data.get("assigned_path_json")

        new_train = Train(
            train_id=train_data["train_id"],
            train_number=train_data["train_number"],
            train_name=train_data["train_name"],
            train_type=train_data["train_type"],
            priority_class=train_data.get("priority_class", 2),
            origin_station_code=train_data["origin_station_code"],
            destination_station_code=train_data["destination_station_code"],
            scheduled_departure_time=train_data["scheduled_departure_time"],
            scheduled_arrival_time=train_data["scheduled_arrival_time"],
            current_status=train_data.get("current_status", "upcoming"),
            current_section_code=train_data.get("current_section_code"),
            original_path_json=json.dumps(original_path) if isinstance(original_path, (list, dict)) else str(original_path or "[]"),
            assigned_path_json=json.dumps(assigned_path) if isinstance(assigned_path, (list, dict)) else (str(assigned_path) if assigned_path else None)
        )
        self.db.add(new_train)
        self.db.commit()
        self.db.refresh(new_train)
        return self._format_train_dict(new_train)

    def _build_network_graph(self) -> nx.Graph:
        """Construct NetworkX graph from sections for rerouting path finding."""
        G = nx.Graph()
        sections = self.get_sections()
        for sec in sections:
            code = sec.get("code", "")
            u = sec.get("start_station_code")
            v = sec.get("end_station_code")
            l = float(sec.get("length_km", 10.0))
            weight = l * 10.0 if code.startswith("SEC_STN") else l
            G.add_edge(u, v, weight=weight, length_km=l, code=code)
        return G

    def add_block_section(self, block_data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert and commit new block_sections record into database, and compute reroutes for affected trains."""
        bs = BlockSection(
            section_id=block_data["section_id"],
            block_group_id=block_data["block_group_id"],
            track_number=block_data.get("track_number", 1),
            start_time=block_data["start_time"],
            duration=block_data["duration"],
            status=block_data.get("status", "Proposed"),
            traffic_sensitivity=block_data.get("traffic_sensitivity", "High"),
            from_station_code=block_data["from_station_code"],
            to_station_code=block_data["to_station_code"]
        )
        self.db.add(bs)
        self.db.commit()
        self.db.refresh(bs)

        # Compute reroutes for all impacted trains and persist into DB
        graph = self._build_network_graph()
        impacted_trains = self.get_impacted_trains_for_block(bs.from_station_code, bs.to_station_code)
        rerouted_trains = []

        for t in impacted_trains:
            reroute_res = compute_rerouted_path_for_train(
                train=t,
                from_station_code=bs.from_station_code,
                to_station_code=bs.to_station_code,
                network_graph=graph
            )
            if reroute_res and reroute_res.get("assigned_path"):
                db_train = self.db.query(Train).filter(Train.train_id == t["train_id"]).first()
                if db_train:
                    db_train.assigned_path_json = json.dumps(reroute_res["assigned_path"])
                    db_train.current_status = "rerouted"
                    if reroute_res.get("scheduled_departure_time"):
                        db_train.scheduled_departure_time = reroute_res["scheduled_departure_time"]
                    if reroute_res.get("scheduled_arrival_time"):
                        db_train.scheduled_arrival_time = reroute_res["scheduled_arrival_time"]
                    rerouted_trains.append(self._format_train_dict(db_train))

        if rerouted_trains:
            self.db.commit()

        return {
            "id": bs.id,
            "section_id": bs.section_id,
            "block_group_id": bs.block_group_id,
            "track_number": bs.track_number,
            "start_time": bs.start_time,
            "duration": bs.duration,
            "status": bs.status,
            "traffic_sensitivity": bs.traffic_sensitivity,
            "from_station_code": bs.from_station_code,
            "to_station_code": bs.to_station_code,
            "rerouted_trains": rerouted_trains,
            "rerouted_count": len(rerouted_trains)
        }

    def get_block_sections(self) -> List[Dict[str, Any]]:
        """Retrieve all block section records from database."""
        sections = self.db.query(BlockSection).all()
        return [
            {
                "id": s.id,
                "section_id": s.section_id,
                "block_group_id": s.block_group_id,
                "track_number": s.track_number,
                "start_time": s.start_time,
                "duration": s.duration,
                "status": s.status,
                "traffic_sensitivity": s.traffic_sensitivity,
                "from_station_code": s.from_station_code,
                "to_station_code": s.to_station_code
            }
            for s in sections
        ]

    def get_impacted_trains_for_block(self, from_stn: str, to_stn: str) -> List[Dict[str, Any]]:
        """Dynamically compute which trains pass through from_stn -> to_stn in sequence and ensure alternate paths are assigned."""
        all_trains = self.get_trains()
        impacted = []
        graph = None
        for t in all_trains:
            # Impact is determined by the train's original planned path (or assigned path if already set)
            orig_data = t.get("original_path") or []
            path_data = orig_data if orig_data else (t.get("assigned_path") or [])
            station_sequence = []
            for item in path_data:
                if isinstance(item, dict) and "station_code" in item:
                    station_sequence.append(str(item["station_code"]).upper())
                elif isinstance(item, str):
                    station_sequence.append(item.upper())

            from_upper = from_stn.upper()
            to_upper = to_stn.upper()

            is_impacted = False
            if from_upper in station_sequence and to_upper in station_sequence:
                idx_from = station_sequence.index(from_upper)
                idx_to = station_sequence.index(to_upper)
                if idx_from < idx_to:
                    is_impacted = True

            if is_impacted:
                # If assigned_path is not yet computed for this train, compute it now
                if not t.get("assigned_path"):
                    if graph is None:
                        graph = self._build_network_graph()
                    reroute_res = compute_rerouted_path_for_train(
                        train=t,
                        from_station_code=from_stn,
                        to_station_code=to_stn,
                        network_graph=graph
                    )
                    if reroute_res and reroute_res.get("assigned_path"):
                        db_train = self.db.query(Train).filter(Train.train_id == t["train_id"]).first()
                        if db_train:
                            db_train.assigned_path_json = json.dumps(reroute_res["assigned_path"])
                            db_train.current_status = "rerouted"
                            if reroute_res.get("scheduled_departure_time"):
                                db_train.scheduled_departure_time = reroute_res["scheduled_departure_time"]
                            if reroute_res.get("scheduled_arrival_time"):
                                db_train.scheduled_arrival_time = reroute_res["scheduled_arrival_time"]
                            self.db.commit()
                            t = self._format_train_dict(db_train)
                impacted.append(t)
        return impacted

