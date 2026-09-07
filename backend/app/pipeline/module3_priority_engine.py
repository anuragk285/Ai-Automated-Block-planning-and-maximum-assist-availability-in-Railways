from typing import Dict, Any, List
from app.config import settings

def compute_request_priority(
    request: Dict[str, Any],
    ml_asset_risk_score: float = 0.3,
    weather_risk_level: str = "Low",
    weights: Dict[str, float] = None
) -> Dict[str, Any]:
    """
    Computes a composite priority score and bucket for a maintenance request.
    
    Inputs:
    - request: dict containing declared_urgency (1-5), due_date_days (1-30)
    - ml_asset_risk_score: predicted asset degradation risk (0.0 to 1.0)
    - weather_risk_level: Low, Medium, High
    - weights: optional override for priority weight dict
    """
    if weights is None:
        weights = {
            "urgency": settings.WEIGHT_DECLARED_URGENCY,
            "asset_risk": settings.WEIGHT_ASSET_RISK,
            "due_date": settings.WEIGHT_DUE_DATE,
            "weather": settings.WEIGHT_WEATHER_RISK,
        }

    # Normalize components to 0.0 - 1.0 scale
    urgency_val = float(request.get("declared_urgency", 3))
    urgency_norm = min(max(urgency_val / 5.0, 0.2), 1.0)

    asset_risk_norm = min(max(ml_asset_risk_score, 0.0), 1.0)

    due_days = max(float(request.get("due_date_days", 3)), 1.0)
    due_pressure_norm = min(max(1.0 / due_days, 0.1), 1.0)

    weather_map = {"Low": 0.1, "Medium": 0.5, "High": 0.9}
    weather_norm = weather_map.get(weather_risk_level, 0.1)

    # Calculate weighted composite score (0 to 100)
    raw_score = (
        weights["urgency"] * urgency_norm +
        weights["asset_risk"] * asset_risk_norm +
        weights["due_date"] * due_pressure_norm +
        weights["weather"] * weather_norm
    ) * 100.0

    priority_score = round(raw_score, 1)

    # Bucket classification
    if priority_score >= 75.0:
        bucket = "Critical"
    elif priority_score >= 55.0:
        bucket = "High"
    elif priority_score >= 35.0:
        bucket = "Medium"
    else:
        bucket = "Low"

    return {
        "request_id": request.get("request_id"),
        "priority_score": priority_score,
        "priority_bucket": bucket,
        "breakdown": {
            "declared_urgency_contrib": round(weights["urgency"] * urgency_norm * 100, 1),
            "asset_risk_contrib": round(weights["asset_risk"] * asset_risk_norm * 100, 1),
            "due_date_pressure_contrib": round(weights["due_date"] * due_pressure_norm * 100, 1),
            "weather_risk_contrib": round(weights["weather"] * weather_norm * 100, 1),
        }
    }
