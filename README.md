# MAHAKUMBH • VAHINI_OS

Real-time command-and-control platform for Mahakumbh operations, built as a full-stack TypeScript system with a cyber-ops UI, live mission board, and smart volunteer dispatch.

---

## What this project does

VAHINI_OS helps coordinate volunteers and incidents across sectors:

- **Admin control room** for live sector stress heatmap, dispatch actions, incident logging, emergency broadcasts, and personnel onboarding.
- **Volunteer console** for check-in/out, mission engagement, SOS escalation, backup requests, and mission completion.
- **Smart dispatch engine** that prioritizes incidents, matches skills, and chooses nearest active volunteers.
- **SQLite-backed API** that stores volunteers, sectors, tasks, notifications, telemetry, and mission state.

---

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite + Lucide icons
- **Backend:** Express 5 + TypeScript + Knex
- **Database:** SQLite3 (`database.sqlite` at repo root)
- **Runtime:** Node.js (ESM)

---

## Repository structure

```text
mahakumbh/
├── backend/
│   ├── src/
│   │   ├── index.ts     # Express API + dispatch/stress logic
│   │   ├── db.ts        # SQLite schema init + migrations-like checks
│   │   └── seed.ts      # Mock data seeder
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx      # Main admin + volunteer UI
│   │   ├── index.css    # Main UI theme and styles
│   │   └── App.css      # Template stylesheet (legacy)
│   └── package.json
└── shared/
    └── types.ts         # Shared domain typings
```

---

## Core capabilities

### 1) Sector intelligence
- Sector stress levels with heatmap visualization.
- Critical/understaffed/SOS zone highlighting.
- Sector-level filtering for mission logs.

### 2) Mission lifecycle
- Create incidents with skill + priority (`low`, `medium`, `high`, `emergency`).
- Track pending/in-progress/completed tasks.
- Multi-volunteer assignments with lead ownership.
- Mission timers and stalled-mission detection.

### 3) Smart dispatch
- Prioritizes high-urgency incidents first.
- Filters candidates by required skills and workload.
- Chooses nearest volunteer based on sector/volunteer coordinates.
- Emits dispatch notifications, including cross-sector movement alerts.

### 4) Volunteer operations
- Duty activation/deactivation per sector.
- Mission join flow for backup and pending incidents.
- SOS toggle with emergency notification broadcast.
- Workload increments/decrements as assignments progress.

### 5) Live operational feed
- Notifications stream for admin + volunteers.
- Emergency-targeted sector messaging.
- Telemetry cards: active force, stress, unresolved incidents, utilization.

---

## Local setup

### Prerequisites
- Node.js 20+ recommended
- npm

### 1) Install dependencies

```bash
cd /tmp/workspace/priyanshaggarwal001/mahakumbh/backend && npm install
cd /tmp/workspace/priyanshaggarwal001/mahakumbh/frontend && npm install
```

### 2) (Optional) Seed sample data

```bash
cd /tmp/workspace/priyanshaggarwal001/mahakumbh/backend
npx tsx src/seed.ts
```

### 3) Start backend

```bash
cd /tmp/workspace/priyanshaggarwal001/mahakumbh/backend
npm run dev
```

Backend runs on `http://localhost:3001`.

### 4) Start frontend

```bash
cd /tmp/workspace/priyanshaggarwal001/mahakumbh/frontend
npm run dev
```

Frontend runs on Vite default (`http://localhost:5173`).

---

## Scripts

### Backend (`/backend/package.json`)
- `npm run start` → run API once with `tsx`
- `npm run dev` → watch mode API server

### Frontend (`/frontend/package.json`)
- `npm run dev` → Vite dev server
- `npm run build` → TypeScript compile + production build
- `npm run lint` → ESLint
- `npm run preview` → preview built app

---

## API overview

### Volunteers
- `GET /api/volunteers`
- `POST /api/volunteers`
- `POST /api/volunteers/:id/location`
- `POST /api/volunteers/:id/checkin`
- `POST /api/volunteers/:id/checkout`
- `POST /api/volunteers/:id/sos`

### Sectors
- `GET /api/sectors`
- `POST /api/simulate`

### Tasks / Missions
- `GET /api/tasks`
- `POST /api/tasks`
- `POST /api/tasks/:id/assign`
- `POST /api/tasks/:id/request-backup`
- `POST /api/tasks/:id/complete`
- `POST /api/optimize`

### Notifications / Auth / Analytics
- `GET /api/notifications`
- `POST /api/notifications`
- `POST /api/login`
- `GET /api/analytics`

---

## Login behavior

- **Admin login:** role=`admin`, username must be `admin`.
- **Volunteer login:** role=`volunteer`, username must match a volunteer name in DB.

Seed examples include `Arjun Sharma`, `Priya Verma`, `Rohan Gupta`, etc.

---

## Data model (high level)

- `volunteers`: identity, skills, status, location, workload, SOS flag, optional geo.
- `sectors`: capacity, demand, volunteer count, stress level, geo coordinates.
- `tasks`: incident metadata, required skills, assignment state, priority, timestamps.
- `notifications`: operational alerts with optional sector targeting.

---

## Operational notes

- Data polling is every ~3 seconds in the frontend after login.
- Stress level updates are tied to task state changes and simulation trigger.
- Emergency tasks generate emergency notifications automatically.
- Current authentication is demo-grade (no passwords/tokens).

---

## Known gaps / production hardening ideas

- Add real authentication + authorization (JWT/session + RBAC).
- Move from polling to WebSockets/SSE for true real-time updates.
- Add input validation and centralized API error handling.
- Add automated tests (backend + frontend).
- Add migration tooling and environment-based configuration.
- Add observability (structured logs, traces, metrics).

---

## License

No license file is currently defined in this repository.
