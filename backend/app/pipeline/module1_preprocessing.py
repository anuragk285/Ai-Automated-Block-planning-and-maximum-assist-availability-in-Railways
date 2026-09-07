import pandas as pd
from typing import List, Dict, Any

VALID_DEPARTMENTS = {"ENG", "TRAC", "ST"}
VALID_URGENCIES = {1, 2, 3, 4, 5}

def preprocess_maintenance_requests(requests: List[Dict[str, Any]]) -> pd.DataFrame:
    """Clean, validate, and normalize maintenance requests."""
    if not requests:
        return pd.DataFrame()

    df = pd.DataFrame(requests)

    # Required columns validation
    required_cols = ["request_id", "department", "section_code", "requested_duration_hrs", "declared_urgency", "due_date_days"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing required column in maintenance request: {col}")

    # Data type conversion & bounds check
    df["requested_duration_hrs"] = pd.to_numeric(df["requested_duration_hrs"], errors="coerce").fillna(2.0)
    df["requested_duration_hrs"] = df["requested_duration_hrs"].clip(lower=0.5, upper=12.0)

    df["declared_urgency"] = pd.to_numeric(df["declared_urgency"], errors="coerce").fillna(3).astype(int)
    df["declared_urgency"] = df["declared_urgency"].clip(lower=1, upper=5)

    df["due_date_days"] = pd.to_numeric(df["due_date_days"], errors="coerce").fillna(3).astype(int)
    df["due_date_days"] = df["due_date_days"].clip(lower=1, upper=30)

    # Validate department strings
    df["department"] = df["department"].apply(lambda d: str(d).upper() if str(d).upper() in VALID_DEPARTMENTS else "ENG")

    return df

def preprocess_asset_conditions(conditions: List[Dict[str, Any]]) -> pd.DataFrame:
    """Clean and normalize asset condition readings."""
    if not conditions:
        return pd.DataFrame()

    df = pd.DataFrame(conditions)
    df["track_wear_mm"] = pd.to_numeric(df["track_wear_mm"], errors="coerce").fillna(2.0).clip(lower=0.0, upper=25.0)
    df["catenary_wear_pct"] = pd.to_numeric(df["catenary_wear_pct"], errors="coerce").fillna(10.0).clip(lower=0.0, upper=100.0)
    df["signal_fault_frequency"] = pd.to_numeric(df["signal_fault_frequency"], errors="coerce").fillna(0.1).clip(lower=0.0, upper=10.0)
    df["ballast_compaction_pct"] = pd.to_numeric(df["ballast_compaction_pct"], errors="coerce").fillna(85.0).clip(lower=0.0, upper=100.0)
    df["joint_temperature_c"] = pd.to_numeric(df["joint_temperature_c"], errors="coerce").fillna(30.0).clip(lower=-10.0, upper=70.0)

    return df
