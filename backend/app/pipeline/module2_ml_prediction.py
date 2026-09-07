import os
import pickle
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple
try:
    from xgboost import XGBClassifier, XGBRegressor
    HAS_XGBOOST = True
except Exception:
    HAS_XGBOOST = False

from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor, RandomForestClassifier
from app.config import settings

class MLPredictor:
    """
    ML Prediction Service for Railway Maintenance System.
    
    IMPORTANT ARCHITECTURAL BOUNDARY:
    ML models provide predictive signals (risk score, estimated duration, expected disruption, weather risk).
    ML NEVER decides whether a plan or block is SAFE -- safety is 100% enforced by the Safety Engine.
    """

    _instance = None

    def __init__(self):
        self.asset_risk_model = None
        self.duration_model = None
        self.traffic_disruption_model = None
        self.weather_model = None
        self.is_trained = False

        os.makedirs(settings.MODEL_DIR, exist_ok=True)

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
            cls._instance.train_or_load_models()
        return cls._instance

    def train_or_load_models(self):
        """Train or load pre-trained model artifacts."""
        asset_path = os.path.join(settings.MODEL_DIR, "asset_risk.pkl")
        duration_path = os.path.join(settings.MODEL_DIR, "duration.pkl")
        traffic_path = os.path.join(settings.MODEL_DIR, "traffic.pkl")
        weather_path = os.path.join(settings.MODEL_DIR, "weather.pkl")

        if os.path.exists(asset_path) and os.path.exists(duration_path) and os.path.exists(traffic_path):
            try:
                with open(asset_path, "rb") as f:
                    self.asset_risk_model = pickle.load(f)
                with open(duration_path, "rb") as f:
                    self.duration_model = pickle.load(f)
                with open(traffic_path, "rb") as f:
                    self.traffic_disruption_model = pickle.load(f)
                with open(weather_path, "rb") as f:
                    self.weather_model = pickle.load(f)
                self.is_trained = True
                return
            except Exception:
                pass # Fallback to retraining if loading fails

        self.train_all_models()

    def train_all_models(self):
        """Train ML models on synthetic historical training data."""
        np.random.seed(settings.RANDOM_SEED)
        n_samples = 500

        # 1. XGBoost Asset Risk Classifier
        # Features: [track_wear_mm, catenary_wear_pct, signal_fault_freq, ballast_compaction_pct, joint_temp_c]
        X_asset = np.random.uniform(
            low=[0.5, 2.0, 0.0, 50.0, 20.0],
            high=[15.0, 95.0, 8.0, 100.0, 65.0],
            size=(n_samples, 5)
        )
        # Synthetic risk calculation: wear + fault freq - ballast compaction
        risk_score_raw = (X_asset[:, 0] / 15.0)*0.35 + (X_asset[:, 1] / 100.0)*0.25 + (X_asset[:, 2] / 8.0)*0.25 + ((100 - X_asset[:, 3]) / 50.0)*0.15
        y_asset = np.digitize(risk_score_raw, bins=[0.25, 0.50, 0.75]) # 0=Low, 1=Med, 2=High, 3=Critical

        if HAS_XGBOOST:
            try:
                self.asset_risk_model = XGBClassifier(n_estimators=30, max_depth=4, random_state=settings.RANDOM_SEED)
                self.asset_risk_model.fit(X_asset, y_asset)
            except Exception:
                self.asset_risk_model = GradientBoostingClassifier(n_estimators=30, max_depth=4, random_state=settings.RANDOM_SEED)
                self.asset_risk_model.fit(X_asset, y_asset)
        else:
            self.asset_risk_model = GradientBoostingClassifier(n_estimators=30, max_depth=4, random_state=settings.RANDOM_SEED)
            self.asset_risk_model.fit(X_asset, y_asset)

        # 2. Duration Regressor
        # Features: [declared_urgency, defect_type_code, location_km]
        X_dur = np.random.uniform(low=[1, 0, 5.0], high=[5, 10, 200.0], size=(n_samples, 3))
        y_dur = 1.5 + X_dur[:, 0] * 0.4 + X_dur[:, 1] * 0.2 + np.random.normal(0, 0.2, size=n_samples)
        y_dur = np.clip(y_dur, 1.0, 6.0)

        if HAS_XGBOOST:
            try:
                self.duration_model = XGBRegressor(n_estimators=30, max_depth=3, random_state=settings.RANDOM_SEED)
                self.duration_model.fit(X_dur, y_dur)
            except Exception:
                self.duration_model = GradientBoostingRegressor(n_estimators=30, max_depth=3, random_state=settings.RANDOM_SEED)
                self.duration_model.fit(X_dur, y_dur)
        else:
            self.duration_model = GradientBoostingRegressor(n_estimators=30, max_depth=3, random_state=settings.RANDOM_SEED)
            self.duration_model.fit(X_dur, y_dur)

        # 3. Traffic Disruption Regressor
        # Features: [start_time_hr, duration_hrs, train_count, is_night]
        X_traffic = np.random.uniform(low=[0.0, 1.0, 0.0, 0.0], high=[24.0, 6.0, 20.0, 1.0], size=(n_samples, 4))
        y_traffic = X_traffic[:, 2] * 4.0 + (1.0 - X_traffic[:, 3]) * 15.0 + X_traffic[:, 1] * 2.5
        y_traffic = np.clip(y_traffic, 0.0, 100.0)

        if HAS_XGBOOST:
            try:
                self.traffic_disruption_model = XGBRegressor(n_estimators=30, max_depth=4, random_state=settings.RANDOM_SEED)
                self.traffic_disruption_model.fit(X_traffic, y_traffic)
            except Exception:
                self.traffic_disruption_model = GradientBoostingRegressor(n_estimators=30, max_depth=4, random_state=settings.RANDOM_SEED)
                self.traffic_disruption_model.fit(X_traffic, y_traffic)
        else:
            self.traffic_disruption_model = GradientBoostingRegressor(n_estimators=30, max_depth=4, random_state=settings.RANDOM_SEED)
            self.traffic_disruption_model.fit(X_traffic, y_traffic)

        # 4. Random Forest Weather Risk Classifier
        # Features: [temperature_c, rainfall_mm, wind_speed_kmh]
        X_weather = np.random.uniform(low=[10.0, 0.0, 5.0], high=[50.0, 80.0, 60.0], size=(n_samples, 3))
        y_weather = []
        for row in X_weather:
            t, r, w = row
            if r > 30.0 or w > 45.0 or t > 45.0:
                y_weather.append(2) # High
            elif r > 10.0 or w > 25.0:
                y_weather.append(1) # Medium
            else:
                y_weather.append(0) # Low

        self.weather_model = RandomForestClassifier(n_estimators=25, random_state=settings.RANDOM_SEED)
        self.weather_model.fit(X_weather, y_weather)

        # Save artifacts
        with open(os.path.join(settings.MODEL_DIR, "asset_risk.pkl"), "wb") as f:
            pickle.dump(self.asset_risk_model, f)
        with open(os.path.join(settings.MODEL_DIR, "duration.pkl"), "wb") as f:
            pickle.dump(self.duration_model, f)
        with open(os.path.join(settings.MODEL_DIR, "traffic.pkl"), "wb") as f:
            pickle.dump(self.traffic_disruption_model, f)
        with open(os.path.join(settings.MODEL_DIR, "weather.pkl"), "wb") as f:
            pickle.dump(self.weather_model, f)

        self.is_trained = True

    def predict_asset_risk(self, condition: Dict[str, Any]) -> Tuple[float, str]:
        """Predicts asset failure risk score (0.0 to 1.0) and bucket label."""
        if not self.is_trained or self.asset_risk_model is None:
            return 0.3, "Medium"

        feats = np.array([[
            float(condition.get("track_wear_mm", 2.0)),
            float(condition.get("catenary_wear_pct", 10.0)),
            float(condition.get("signal_fault_frequency", 0.1)),
            float(condition.get("ballast_compaction_pct", 85.0)),
            float(condition.get("joint_temperature_c", 35.0)),
        ]])

        probs = self.asset_risk_model.predict_proba(feats)[0]
        # Weighted risk score: 0*P(Low) + 0.3*P(Med) + 0.7*P(High) + 1.0*P(Critical)
        classes = self.asset_risk_model.classes_
        score = 0.0
        weights_map = {0: 0.1, 1: 0.4, 2: 0.75, 3: 1.0}
        for cls_idx, prob in zip(classes, probs):
            score += weights_map.get(cls_idx, 0.3) * prob

        score = min(max(round(float(score), 2), 0.0), 1.0)

        if score >= 0.75:
            label = "Critical"
        elif score >= 0.50:
            label = "High"
        elif score >= 0.25:
            label = "Medium"
        else:
            label = "Low"

        return score, label

    def predict_duration(self, request: Dict[str, Any]) -> float:
        """Predicts expected actual maintenance duration in hours."""
        if not self.is_trained or self.duration_model is None:
            return float(request.get("requested_duration_hrs", 2.5))

        urgency = float(request.get("declared_urgency", 3))
        loc = float(request.get("location_km", 10.0))
        defect_code = hash(request.get("defect_type", "General")) % 10

        feats = np.array([[urgency, defect_code, loc]])
        pred = self.duration_model.predict(feats)[0]
        return max(round(float(pred), 1), 1.0)

    def predict_traffic_disruption(self, section_code: str, start_hr: float, end_hr: float, train_count: int) -> float:
        """Predicts train traffic disruption score for a time window."""
        if not self.is_trained or self.traffic_disruption_model is None:
            is_night = 1.0 if (1.0 <= start_hr <= 4.5) else 0.0
            score = train_count * 3.5 + (1.0 - is_night) * 10.0
            return round(score, 1)

        duration = end_hr - start_hr
        is_night = 1.0 if (1.0 <= start_hr <= 4.5) else 0.0

        feats = np.array([[start_hr, duration, float(train_count), is_night]])
        pred = self.traffic_disruption_model.predict(feats)[0]
        return max(round(float(pred), 1), 0.0)

    def predict_weather_risk(self, forecast: Dict[str, Any]) -> str:
        """Predicts weather risk classification."""
        if not self.is_trained or self.weather_model is None:
            return "Low"

        temp = float(forecast.get("temperature_c", 30.0))
        rain = float(forecast.get("rainfall_mm", 0.0))
        wind = float(forecast.get("wind_speed_kmh", 10.0))

        feats = np.array([[temp, rain, wind]])
        pred_cls = self.weather_model.predict(feats)[0]
        label_map = {0: "Low", 1: "Medium", 2: "High"}
        return label_map.get(int(pred_cls), "Low")
