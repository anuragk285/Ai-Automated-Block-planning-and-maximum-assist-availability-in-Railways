# AI-Assisted Automatic Block Planning System for Indian Railways (SIH26027)

A prototype of an AI-assisted decision-support system that plans railway maintenance blocks for Indian Railways. The system merges compatible maintenance work from multiple departments (Engineering, Traction/OHE, Signals & Telecom), selects lowest-disruption time windows, uses ML models for predictive risk & traffic scoring, enforces hard deterministic safety rules, validates network-wide train rerouting impact via NetworkX, solves global schedules using Google OR-Tools CP-SAT, provides human planner approval workflows, and handles live traffic drift & emergency re-planning.

---

## Key System Architecture & Core Principle

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   AI PREDICTS   │  ──►  │  RULES PROTECT  │  ──►  │ OPTIMIZER SECTS │  ──►  │ PLANNER APPROVES│
│ ML Risk & Traffic│       │  Safety Engine  │       │ Google OR-Tools │       │ Human Decision  │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

> **CORE IDEA**: Combine compatible maintenance into fewer, safer, better-timed blocks — minimizing train disruption and maximizing practical asset availability.

---

## Tech Stack
- **Backend**: Python 3.13, FastAPI, SQLAlchemy, SQLite (abstracted for Postgres), Google OR-Tools CP-SAT, NetworkX, scikit-learn / XGBoost.
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Recharts, Lucide Icons.
- **Data Access Layer**: Abstract `DataSource` interface with a seedable synthetic generator producing realistic stations (~14), track sections (~20), trains (~50/day), maintenance requests (~20), sensor readings, and resource pools.

---

## Quick Start & Run Instructions

### 1. Backend Setup & Startup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
python3 -m pip install -r requirements.txt

# Seed the database (optional - server auto-seeds on first startup)
python3 seed_cli.py

# Run FastAPI backend server
python3 -m uvicorn app.main:app --reload --port 8000
```
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

---

### 2. Frontend Setup & Startup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite React development server
npm run dev
```
- Control Dashboard UI: `http://localhost:5173`

---

### 3. Run Automated Tests

```bash
# Run unit & end-to-end integration test suite
PYTHONPATH=backend python3 -m pytest backend/tests/
```

---

## Verification & Features Demonstration

1. **Multi-Department Block Merging**:
   - On section `SEC_GZB_ALJN`, ENG track tamping (3.0h), TRAC catenary wire alignment (2.5h), and ST axle counter testing (2.0h) are merged into a single **3.5-hour shared night block**, saving 4.0 hours of track possession time.
2. **Lowest-Disruption Time Window Selection**:
   - The CP-SAT optimizer automatically shifts maintenance blocks to quiet night hours (01:30 - 04:30 AM), reducing affected passenger train count from ~15 trains down to 0-1 trains.
3. **Machine-Readable Safety Engine Audit**:
   - Click any block in the **Block Plan** tab and press **"Explain Block"** to inspect deterministic hard rule checks (Worker Skills, Equipment Availability, Weather Limits, Task Dependencies, Track Locks).
4. **Human Controller Approval Workflow**:
   - Approve or Reject proposed maintenance blocks with mandatory rejection audit reasons.
5. **Live Traffic Drift Simulation**:
   - Go to the **Live Traffic Monitoring** tab and click **"Simulate Live Traffic Delays"** to perturb timetables and trigger real-time disruption drift alerts with suggested alternative time slots.
6. **Emergency Block Injection**:
   - Go to **Emergency Control**, submit an emergency block report, and inspect the side-by-side local neighborhood re-optimization schedule diff.
