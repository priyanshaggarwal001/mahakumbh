# Mahakumbh Operations Command Platform

A full-stack command-and-control system for managing volunteer deployment, sector stress, emergency response, and live operations for a large public event setup.

## System Overview

This repository contains:

- **Frontend (`/frontend`)**: React + TypeScript + Vite dashboard for admins and volunteers.
- **Backend (`/backend`)**: Express + TypeScript API with SQLite storage (via Knex).
- **Shared runtime**: `docker-compose.yml` to run both services together with persisted database volume.

Core capabilities include:

- Volunteer registration, check-in/check-out, SOS activation
- Incident/task creation with priority (`low`, `medium`, `high`, `emergency`)
- Smart dispatch optimization based on skill match, workload, and proximity
- Sector stress tracking and live operations telemetry
- Notifications and emergency broadcasts
- Basic analytics for utilization and busiest zone

## Architecture

```text
React Frontend (Nginx, port 80)
        |
        | HTTP (VITE_API_URL)
        v
Express API (Node, port 3001)
        |
        v
SQLite database (file, persisted in Docker volume)
```

### Data Model (high-level)

- **volunteers**: identity, skills, status, location, workload, SOS state
- **sectors**: zone metadata, capacity, stress, coordinates
- **tasks**: mission details, required skills, priority, assignment(s), lifecycle status
- **notifications**: operational and emergency feed items

## Repository Structure

```text
.
├── backend/
│   ├── src/index.ts      # API routes and dispatch/stress logic
│   ├── src/db.ts         # schema creation/migrations on startup
│   ├── src/seed.ts       # reset utility
│   └── Dockerfile
├── frontend/
│   ├── src/App.tsx       # main dashboard + volunteer UI
│   └── Dockerfile
└── docker-compose.yml
```

## Prerequisites

For local (non-Docker) runs:

- Node.js 20+
- npm 10+

For containerized runs:

- Docker
- Docker Compose

## Quick Start with Docker (Recommended)

From repository root:

```bash
docker compose up --build
```

Then access:

- Frontend UI: `http://localhost`
- Backend API: `http://localhost:3001`

### Docker Details

- Backend container stores SQLite DB at `/app/data/database.sqlite`.
- Database is persisted in the named volume: `mahakumbh_data`.
- Frontend build-time API base URL is provided through compose arg:
  - `VITE_API_URL=http://localhost:3001`

### Stop and clean up

```bash
docker compose down
```

To also remove persisted data:

```bash
docker compose down -v
```

## Local Development (Without Docker)

Open two terminals.

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:3001`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` by default (Vite dev server).

Set API URL if needed:

```bash
VITE_API_URL=http://localhost:3001 npm run dev
```

## Available Scripts

### Backend (`/backend/package.json`)

- `npm run dev` – watch mode via `tsx`
- `npm run start` – start API
- `npm test` – placeholder script (currently exits with error by design)

### Frontend (`/frontend/package.json`)

- `npm run dev` – start Vite dev server
- `npm run build` – production build
- `npm run lint` – ESLint checks
- `npm run preview` – preview production build

## API Surface (Operational)

Base URL: `http://localhost:3001`

- `POST /api/login`
- `GET/POST /api/volunteers`
- `POST /api/volunteers/:id/checkin`
- `POST /api/volunteers/:id/checkout`
- `POST /api/volunteers/:id/location`
- `POST /api/volunteers/:id/sos`
- `GET /api/sectors`
- `GET/POST /api/tasks`
- `POST /api/tasks/:id/assign`
- `POST /api/tasks/:id/request-backup`
- `POST /api/tasks/:id/complete`
- `POST /api/optimize`
- `GET/POST /api/notifications`
- `GET /api/analytics`
- `POST /api/simulate`

## Operational Flow (Typical)

1. Admin logs in and registers personnel.
2. Volunteers check in to sectors.
3. Admin creates tasks and sets priority.
4. Smart dispatch assigns best-fit volunteers.
5. Volunteers execute, request backup, or complete missions.
6. Notifications and analytics update continuously in UI.

## Notes

- Backend initializes and evolves schema automatically at startup.
- Frontend polls backend every few seconds for near real-time updates.
- If you change backend URL in deployment, rebuild frontend image with the new `VITE_API_URL`.
