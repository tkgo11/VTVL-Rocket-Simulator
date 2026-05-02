# VTVL Rocket Landing Simulator

A pnpm monorepo whose headline artifact is an interactive vertical-takeoff, vertical-landing (VTVL) rocket simulator — think Falcon 9 / Starship-style powered descent — running entirely in the browser with real Newtonian physics.

## Artifacts

| Artifact | Package | Preview path | Description |
|---|---|---|---|
| VTVL Simulator | `@workspace/vtvl-sim` | `/` | Interactive rocket landing simulator (see [Features](#simulator-features)) |
| API Server | `@workspace/api-server` | `/api` | Shared Express 5 REST API; not currently consumed by the simulator |
| Canvas / Mockup Sandbox | `@workspace/mockup-sandbox` | `/__mockup` | Design playground for component exploration |

## Tech stack

- **Runtime**: Node.js 24
- **Package manager**: pnpm workspaces
- **Language**: TypeScript 5.9
- **Simulator frontend**: Vite 7 + React 19 + Three.js / React Three Fiber + Tailwind CSS 4
- **API server**: Express 5 + Drizzle ORM + PostgreSQL + Zod (`zod/v4`)
- **API codegen**: Orval (generates React Query hooks and Zod schemas from an OpenAPI spec)
- **API build**: esbuild (CJS bundle)
- **License**: MIT

## Getting started

Install all workspace dependencies from the repo root:

```bash
pnpm install
```

Start an artifact's dev server:

```bash
# VTVL Simulator (Vite, hot-reload)
pnpm --filter @workspace/vtvl-sim run dev

# API Server (build + start)
pnpm --filter @workspace/api-server run dev

# Canvas / Mockup Sandbox
pnpm --filter @workspace/mockup-sandbox run dev
```

## Common workspace scripts

Run from the repo root:

```bash
# Type-check all packages
pnpm run typecheck

# Type-check + build all packages
pnpm run build
```

## API development commands

```bash
# Regenerate React Query hooks and Zod schemas from the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes to the development database
pnpm --filter @workspace/db run push
```

## Simulator features

The VTVL Simulator models powered descent with full Newtonian physics running at a 120 Hz fixed timestep:

- **Physics**: gravity, gimballed thrust, aerodynamic drag, fuel mass depletion, torque and angular dynamics
- **Render modes**: 2D HTML5 canvas (mission-control side view with stars, particle plume, altitude ladder, wind indicator) and 3D React Three Fiber scene (rocket mesh, landing pad, exhaust glow, tracking camera, planet-themed sky and ground)
- **Control**: manual WASD keyboard controls with slider overrides, and a cascaded autopilot that guides the rocket to a soft landing
- **Mission scenarios**: six selectable scenarios — Standard Hop, Suborbital Hop, Drone Ship Crosswind, Low-Fuel Emergency, Lunar Whisper, Martian Touchdown — each with distinct gravity, atmosphere, wind, starting altitude, fuel load, and target pad offset
- **Scoring**: each landing is graded 0–1000 points (touchdown velocity, pad accuracy, fuel reserve, final tilt) and assigned a letter grade (A+ through F); personal bests are persisted to `localStorage`
