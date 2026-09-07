# Repository Naming Conventions & Standard Guidelines

Enforced across the Indian Railways AI Block Planning System (SIH26027) codebase.

---

## 1. Backend (Python, Database, API Payloads)
- **Formatting**: Strict `snake_case` for all function names, variable names, database table names, SQLAlchemy columns, Pydantic schemas, and API JSON payload fields.
- **No camelCase in API responses**: API endpoints return `snake_case` keys directly matching the database and internal models.
- **Descriptive Names**: Generic terms (`data`, `item`, `val`, `temp`, `x`, `d`, `req`) are strictly disallowed. Use clear domain-specific names (`railway_network_data`, `block_plan_item`, `joint_temperature_celsius`, `requested_duration_hours`, `maintenance_request`).

---

## 2. Frontend (React, TypeScript, Styling)
- **Variables, Functions, Props, Hooks**: Strict `camelCase` (e.g. `activeTab`, `handleApproveBlock`, `isOptimizing`, `useTrainData`).
- **Components, Interfaces, Types**: Strict `PascalCase` (e.g. `BlockPlanGantt`, `TrainDetailPanel`, `MaintenanceRequest`).
- **Component File Naming**: Component files are named `PascalCase.tsx` matching the primary component exported (e.g. `TrainsTable.tsx`).
- **Hook File Naming**: Custom hooks are named `useX.ts` (e.g. `useTrainStatus.ts`).

---

## 3. Constants (Both Languages)
- **Formatting**: `UPPER_SNAKE_CASE` (e.g. `WEIGHT_DECLARED_URGENCY`, `DRIFT_ALERT_THRESHOLD`, `MAX_WIND_SPEED_FOR_OHE_KMH`).

---

## 4. 24-Hour Time Format Standard
- **Backend**: All serialized time fields represent time in 24-hour `HH:MM` strings (e.g., `"06:30"`, `"14:45"`, `"22:15"`) or 24-hour decimal hours where explicitly formatted as `HH:MM`. No `AM/PM` strings anywhere in API responses.
- **Frontend**: All visual date and time renders must use the shared `formatTime24(value)` utility function located in `frontend/src/utils/timeFormatter.ts` to output clean 24-hour `HH:MM` time representations.
