# VTVL Rocket Landing Simulator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-24-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

An interactive vertical-takeoff, vertical-landing (VTVL) rocket simulator — think Falcon 9 / Starship-style powered descent — running entirely in the browser with real Newtonian physics. Includes solo missions, multiplayer rooms, a global leaderboard, and a flight recorder/replay system.

## Highlights

- 🚀 **Real physics** at a 120 Hz fixed timestep — gravity, gimballed thrust, drag, fuel mass, torque, angular dynamics
- 🎮 **Two render modes** — 2D mission-control side view and 3D React Three Fiber scene
- 🌍 **Six missions** — from a Standard Hop to a Lunar Whisper and a Martian Touchdown
- 🤖 **Manual or autopilot** — WASD/touch controls or a cascaded autopilot guidance loop
- 🏆 **Scoring & grades** — 0–1000 score and A+/F letter grade per landing, with persistent personal bests
- 📼 **Flight recorder & replay** — scrubbable timeline, variable speed, save/load past flights
- 👥 **Multiplayer** — co-op, versus, and spectate rooms via WebSocket with shareable links
- 📊 **Global leaderboard** — backed by Postgres, optional accounts to keep scores across devices
- 📱 **Mobile support** — responsive HUD with on-screen touch controls

## Repository layout

This is a [pnpm](https://pnpm.io) workspace monorepo. Each package manages its own dependencies.

```
artifacts/
  vtvl-sim/         # React + Vite + Three.js simulator (the headline app)
  api-server/       # Express 5 + WebSocket backend (REST + /ws)
  mockup-sandbox/   # Canvas / component design playground
lib/
  api-spec/         # OpenAPI spec (source of truth for API types)
  api-zod/          # Generated Zod schemas
  api-client-react/ # Generated React Query hooks (Orval)
  db/               # Drizzle ORM schema + migrations
scripts/            # Maintenance scripts
```

| Artifact | Package | Path | Description |
|---|---|---|---|
| VTVL Simulator | `@workspace/vtvl-sim` | `/` | Interactive rocket landing simulator |
| API Server | `@workspace/api-server` | `/api` | Express REST + WebSocket backend |
| Canvas / Mockup Sandbox | `@workspace/mockup-sandbox` | `/__mockup` | Design playground |

## Tech stack

- **Runtime**: Node.js 24
- **Package manager**: pnpm workspaces
- **Language**: TypeScript 5.9
- **Frontend**: Vite 7 · React 19 · Three.js · React Three Fiber · Tailwind CSS 4 · Recharts
- **Backend**: Express 5 · `ws` (WebSocket) · bcryptjs · cookie sessions
- **Database**: PostgreSQL via Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (React Query hooks + Zod schemas from OpenAPI)
- **API build**: esbuild (CJS bundle)

## Getting started

### Prerequisites

- Node.js 24
- pnpm
- A PostgreSQL database (only required for the API server / multiplayer / leaderboard)

### Install

```bash
pnpm install
```

### Environment

The API server reads `DATABASE_URL` (Postgres connection string) from the environment. Solo simulator play does not require any environment variables.

### Run

```bash
# VTVL Simulator (Vite, hot-reload)
pnpm --filter @workspace/vtvl-sim run dev

# API Server (build + start)
pnpm --filter @workspace/api-server run dev

# Canvas / Mockup Sandbox
pnpm --filter @workspace/mockup-sandbox run dev
```

## Common scripts

Run from the repo root:

```bash
pnpm run typecheck     # type-check all packages
pnpm run build         # type-check + build all packages
```

API / DB development:

```bash
# Regenerate React Query hooks and Zod schemas from the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes to the development database
pnpm --filter @workspace/db run push
```

## Simulator features in depth

**Physics** — gravity, gimballed thrust, aerodynamic drag, fuel mass depletion, torque and angular dynamics, all integrated at a 120 Hz fixed timestep.

**Render modes**
- *2D canvas* — mission-control side view with parallax stars, particle exhaust plume, altitude ladder, and wind indicator
- *3D scene* — React Three Fiber with rocket mesh, target landing pad, exhaust glow, ground dust kick-up, tracking camera, and planet-themed sky/ground

**Missions** — Standard Hop · Suborbital Hop · Drone Ship Crosswind · Low-Fuel Emergency · Lunar Whisper · Martian Touchdown. Each varies gravity, atmosphere, wind, fuel load, starting altitude, and target pad offset.

**Controls**
- Desktop: WASD keyboard + sliders, plus a cascaded autopilot
- Mobile: on-screen gimbal pad and press-and-hold BURN button

**Live tuning**
- *Weather panel* — wind speed (-25 to +25 m/s), gust amplitude, with Crosswind / Gusty / Calm presets
- *Vehicle settings* — dry mass, fuel mass, max thrust, ISP, gimbal limit, drag coefficient, gravity, with Falcon 9 / Starship Hop / Lunar Lander presets and live TWR + Δv readouts

**Scoring** — 0–1000 points based on touchdown velocity, pad accuracy, fuel reserve, and final tilt; A+/A/B/C/D/F letter grade; personal bests persisted to `localStorage`.

**Flight recorder & replay** — every flight is captured to a 60 Hz frame buffer. After landing, a scrubbable timeline supports play/pause, 0.25×–4× speed, and ←/→ jog. Recordings can be saved (up to 20 in `localStorage`) and reloaded from the Flight Log modal.

## Multiplayer

The API server provides REST endpoints for auth, rooms, runs, leaderboard, and player stats, plus a `/ws` WebSocket for live presence and gameplay sync.

- **Rooms** — create/join via shareable links (`?room=CODE` or `?spectate=CODE`)
- **Live state** — 10 Hz rocket telemetry broadcast, ready/start/result signaling, heartbeats with auto-reconnect
- **Auth** — guest play out of the box; optional accounts (bcrypt + cookie sessions) keep scores across devices
- **Leaderboard** — top-N by score, optionally filtered by mission; only successful (non-crashed) runs count

## License

[MIT](LICENSE)
