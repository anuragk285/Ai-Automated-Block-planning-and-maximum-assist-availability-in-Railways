import json
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from datetime import datetime
from app.database import Base

class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    zone = Column(String, default="NR")
    schematic_x_position = Column(Float, default=0.0) # Schematic layout X
    schematic_y_position = Column(Float, default=0.0) # Schematic layout Y

class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    start_station_code = Column(String, nullable=False)
    end_station_code = Column(String, nullable=False)
    length_km = Column(Float, nullable=False)
    track_type = Column(String, default="Double") # Single / Double
    total_tracks = Column(Integer, default=2)
    capacity_trains_per_hr = Column(Integer, default=6)
    max_speed_kmh = Column(Float, default=110.0)

class Track(Base):
    __tablename__ = "tracks"

    id = Column(Integer, primary_key=True, index=True)
    track_id = Column(String, unique=True, index=True, nullable=False)
    section_code = Column(String, index=True, nullable=False)
    track_number = Column(Integer, nullable=False) # 1 or 2
    health_status = Column(String, default="healthy") # healthy / blocked
    direction = Column(String, default="BIDIRECTIONAL") # UP / DOWN / BIDIRECTIONAL

class AlternateRoute(Base):
    __tablename__ = "alternate_routes"

    id = Column(Integer, primary_key=True, index=True)
    source_station_code = Column(String, nullable=False)
    target_station_code = Column(String, nullable=False)
    via_stations_json = Column(Text, default="[]") # JSON list of station codes
    additional_distance_km = Column(Float, default=10.0)
    capacity_trains_per_hr = Column(Integer, default=4)

class Train(Base):
    __tablename__ = "trains"

    id = Column(Integer, primary_key=True, index=True)
    train_id = Column(String, unique=True, index=True, nullable=False) # e.g. TRN-12001
    train_number = Column(String, index=True, nullable=False)
    train_name = Column(String, nullable=False)
    train_type = Column(String, nullable=False) # Express, Passenger, Freight
    priority_class = Column(Integer, default=2) # 1: Express, 2: Passenger, 3: Freight
    origin_station_code = Column(String, nullable=False)
    destination_station_code = Column(String, nullable=False)
    scheduled_departure_time = Column(String, nullable=False) # 24hr HH:MM e.g. "06:00"
    scheduled_arrival_time = Column(String, nullable=False) # 24hr HH:MM e.g. "14:30"
    current_status = Column(String, default="upcoming") # upcoming / in_transit / completed / rerouted
    current_section_code = Column(String, nullable=True)
    original_path_json = Column(Text, default="[]") # JSON list of station stop dicts
    assigned_path_json = Column(Text, nullable=True) # JSON list of alternate station stops if rerouted

class Timetable(Base):
    __tablename__ = "timetables"

    id = Column(Integer, primary_key=True, index=True)
    train_number = Column(String, index=True, nullable=False)
    section_code = Column(String, index=True, nullable=False)
    scheduled_entry_min = Column(Integer, nullable=False) # Mins from midnight (0-1439)
    scheduled_exit_min = Column(Integer, nullable=False)
    actual_entry_min = Column(Integer, nullable=True)
    actual_exit_min = Column(Integer, nullable=True)
    is_delayed = Column(Boolean, default=False)
    delay_min = Column(Integer, default=0)

class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True, nullable=False)
    department = Column(String, nullable=False) # ENG, TRAC, ST
    section_code = Column(String, nullable=False)
    target_track_number = Column(Integer, default=1) # 1 or 2
    location_km = Column(Float, nullable=False)
    defect_type = Column(String, nullable=False)
    requested_duration_hours = Column(Float, nullable=False)
    declared_urgency = Column(Integer, nullable=False) # 1 (Low) to 5 (Critical)
    due_date_days = Column(Integer, nullable=False) # Days remaining
    dependencies_json = Column(Text, default="[]") # JSON list of request_ids
    required_skills_json = Column(Text, default="[]") # JSON list of skill codes
    required_equipment_json = Column(Text, default="[]") # JSON list of equip codes
    status = Column(String, default="Pending") # Pending, Grouped, Scheduled

class AssetCondition(Base):
    __tablename__ = "asset_conditions"

    id = Column(Integer, primary_key=True, index=True)
    section_code = Column(String, unique=True, index=True, nullable=False)
    track_wear_mm = Column(Float, default=2.0)
    catenary_wear_pct = Column(Float, default=10.0)
    signal_fault_frequency = Column(Float, default=0.1)
    ballast_compaction_pct = Column(Float, default=85.0)
    joint_temperature_celsius = Column(Float, default=35.0)
    inspection_date = Column(String, default="2026-09-07")

class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(String, unique=True, index=True, nullable=False)
    resource_type = Column(String, nullable=False) # Crew / Equipment
    name = Column(String, nullable=False)
    department = Column(String, nullable=False) # ENG, TRAC, ST
    skill_or_type = Column(String, nullable=False)
    total_count = Column(Integer, default=5)
    available_start_hr = Column(Float, default=0.0)
    available_end_hr = Column(Float, default=24.0)

class BlockPlan(Base):
    __tablename__ = "block_plans"

    id = Column(Integer, primary_key=True, index=True)
    block_id = Column(String, unique=True, index=True, nullable=False)
    group_id = Column(String, nullable=False)
    section_code = Column(String, nullable=False)
    target_track_number = Column(Integer, default=1)
    start_time_hr = Column(Float, nullable=False) # 0.0 to 24.0
    end_time_hr = Column(Float, nullable=False)
    duration_hrs = Column(Float, nullable=False)
    status = Column(String, default="Proposed") # Proposed, Approved, Rejected
    rejection_reason = Column(Text, nullable=True)
    priority_score = Column(Float, default=0.0)
    priority_bucket = Column(String, default="Medium") # Critical, High, Medium, Low
    predicted_disruption = Column(Float, default=0.0)
    network_impact_score = Column(Float, default=0.0)
    assigned_resources_json = Column(Text, default="[]")
    request_ids_json = Column(Text, default="[]")
    safety_checks_json = Column(Text, default="{}")
    decision_reason_json = Column(Text, default="{}")
    resolution_action = Column(String, nullable=True) # Reassigned to Track 2 / Rerouted via bypass

class EmergencyLog(Base):
    __tablename__ = "emergency_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(String, unique=True, index=True, nullable=False)
    section_code = Column(String, nullable=False)
    target_track_number = Column(Integer, default=1)
    severity = Column(String, default="Critical")
    reason = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    duration_hrs = Column(Float, default=4.0)
    affected_block_ids_json = Column(Text, default="[]")

class WeatherForecast(Base):
    __tablename__ = "weather_forecasts"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    day_offset = Column(Integer, default=0)
    temperature_celsius = Column(Float, default=32.0)
    rainfall_mm = Column(Float, default=5.0)
    wind_speed_kmh = Column(Float, default=15.0)
    risk_level = Column(String, default="Low") # Low, Medium, High
