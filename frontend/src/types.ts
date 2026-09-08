export interface MaintenanceRequest {
  request_id: string;
  department: 'ENG' | 'TRAC' | 'ST';
  section_code: string;
  target_track_number?: number;
  location_km: number;
  defect_type: string;
  requested_duration_hours: number;
  declared_urgency: number;
  due_date_days: number;
  dependencies: string[];
  required_skills: string[];
  required_equipment: string[];
  status: string;
  ml_asset_risk_score?: number;
  ml_asset_risk_label?: string;
  priority_score?: number;
  calculated_priority_score?: number;
  priority_bucket?: 'Critical' | 'High' | 'Medium' | 'Low';
  priority_breakdown?: {
    declared_urgency_contrib: number;
    asset_risk_contrib: number;
    due_date_pressure_contrib: number;
    weather_risk_contrib: number;
  };
}

export interface StationNode {
  code: string;
  name: string;
  zone: string;
  schematic_x_position: number;
  schematic_y_position: number;
}

export interface SectionEdge {
  code: string;
  start_station_code: string;
  end_station_code: string;
  length_km: number;
  track_type: string;
  total_tracks: number;
  capacity_trains_per_hr: number;
  max_speed_kmh: number;
}

export interface TrackNode {
  track_id: string;
  section_code: string;
  track_number: number;
  health_status: 'healthy' | 'blocked';
  direction: string;
}

export interface AlternateRoute {
  source_station_code: string;
  target_station_code: string;
  via_stations: string[];
  additional_distance_km: number;
  capacity_trains_per_hr: number;
}

export interface NetworkData {
  stations: StationNode[];
  sections: SectionEdge[];
  tracks: TrackNode[];
  alternate_routes: AlternateRoute[];
}

export interface SafetyCheckItem {
  check_name: string;
  passed: boolean;
  message: string;
}

export interface BlockPlanItem {
  id?: number;
  block_id: string;
  group_id: string;
  section_code: string;
  target_track_number?: number;
  start_time_hr: number;
  end_time_hr: number;
  duration_hrs: number;
  status: 'Proposed' | 'Approved' | 'Rejected';
  rejection_reason?: string;
  priority_score: number;
  priority_bucket: 'Critical' | 'High' | 'Medium' | 'Low';
  predicted_disruption: number;
  network_impact_score: number;
  assigned_resources: { type: string; name: string }[];
  request_ids: string[];
  safety_checks: SafetyCheckItem[];
  decision_reason: {
    optimizer_status?: string;
    objective_value?: number;
    rationale?: string;
  };
  resolution_action?: string;
}

export interface TrainPathStop {
  station_code: string;
  scheduled_time: string; // 24hr "HH:MM"
  is_bypass?: boolean;
}

export type TrainStopInput = TrainPathStop | string;

export interface TrainItem {
  train_id: string;
  train_number: string;
  train_name: string;
  train_type: string; // Express, Passenger, Freight
  priority_class: number;
  origin_station_code: string;
  destination_station_code: string;
  scheduled_departure_time: string; // 24hr "HH:MM"
  scheduled_arrival_time: string; // 24hr "HH:MM"
  current_status: 'upcoming' | 'in_transit' | 'completed' | 'rerouted' | 'Scheduled' | string;
  current_section_code?: string;
  original_path: TrainStopInput[];
  assigned_path?: TrainStopInput[] | null;
}

export interface DriftAlert {
  block_id: string;
  section_code: string;
  original_window: string;
  original_disruption_score: number;
  live_disruption_score: number;
  drift_delta: number;
  severity: string;
  message: string;
  suggested_alternative_window: {
    start_time_hr: number;
    end_time_hr: number;
    predicted_disruption: number;
  };
}

export interface EmergencyDiff {
  emergency_log_id: string;
  section_code: string;
  reason: string;
  emergency_window: string;
  neighborhood_sections: string[];
  affected_blocks_count: number;
  unaffected_frozen_blocks_count: number;
  diff: {
    before_plan: any[];
    after_plan: any[];
  };
}

export interface BlockSectionItem {
  id?: number;
  section_id: string;
  block_group_id: string;
  track_number: number;
  start_time: string;
  duration: string;
  status: string;
  traffic_sensitivity: string;
  from_station_code: string;
  to_station_code: string;
}

