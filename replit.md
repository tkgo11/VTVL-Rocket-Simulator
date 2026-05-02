# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- **VTVL Simulator** (`artifacts/vtvl-sim`, `/`) — VTVL rocket landing simulator with real Newtonian physics (gravity, gimballed thrust, drag, fuel mass, torque/angular dynamics) running at 120Hz fixed timestep. Two render modes: 2D HTML5 canvas (mission-control side view with stars, particle plume, altitude ladder, wind indicator) and 3D React Three Fiber scene (rocket model, target landing pad, exhaust glow, tracking camera, planet-themed sky/ground). Manual controls (WASD / sliders) and cascaded autopilot landing. Six selectable mission scenarios (Standard Hop, Suborbital Hop, Drone Ship Crosswind, Low-Fuel Emergency, Lunar Whisper, Martian Touchdown) with varying gravity, atmosphere, wind, fuel, starting altitude, and target pad offset. Each landing produces a 0–1000 score (touchdown velocity, pad accuracy, fuel reserve, final tilt) and an A+/A/B/C/D/F grade; a per-mission personal best is persisted to localStorage. **Live weather controls** (top-right WEATHER pill) let the pilot tune wind speed (-25 to +25 m/s, signed = direction east/west) and gust amplitude in real time, with Crosswind / Gusty / Calm presets — these override the mission's default wind for both 2D and 3D modes. **Vehicle Settings** (collapsible top-right panel) let the user tune dry mass, fuel mass, max thrust, ISP, max gimbal, drag coefficient, and gravity, with Falcon 9 Booster / Starship Hop / Lunar Lander presets and live TWR + Δv readouts. **Flight Recorder** (collapsible bottom-right panel) shows live recharts for altitude, vertical velocity, throttle, and fuel sampled at 10Hz during flight. **Flight recording & replay**: every flight is captured automatically into a downsampled (60Hz) frame buffer; after landing/crash the score panel exposes a "Review Flight (V)" button that opens a bottom-of-screen Timeline with a scrubbable altitude sparkline, play/pause, 0.25×–4× speed, ←/→ jog, Esc to exit. Replays drive the same Sim2D/Sim3D/HUD components by interpolating recorded frames. Recordings can be saved to localStorage (`vtvl_recordings_v1`, max 20 entries) and re-loaded later from the **Flight Log** modal (top-right). Uses `three`, `@react-three/fiber`, `@react-three/drei`, `recharts`.
- **API Server** (`artifacts/api-server`, `/api`) — shared Express API. Not used by the simulator.
- **Canvas / Mockup Sandbox** (`artifacts/mockup-sandbox`) — design playground.
