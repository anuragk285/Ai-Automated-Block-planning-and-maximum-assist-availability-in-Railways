import json
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.data_access.base import DataSource
from app.models.db_models import (
    Station, Section, Track, AlternateRoute, Train, Timetable,
    MaintenanceRequest, AssetCondition, Resource, WeatherForecast
)

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
