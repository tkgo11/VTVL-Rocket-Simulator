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

- **VTVL Simulator** (`artifacts/vtvl-sim`, `/`) — VTVL rocket landing simulator with real Newtonian physics (gravity, gimballed thrust, drag, fuel mass, torque/angular dynamics) running at 120Hz fixed timestep. Two render modes: 2D HTML5 canvas (mission-control side view with stars, particle plume, altitude ladder) and 3D React Three Fiber scene (rocket model, lit landing pad, exhaust glow, tracking camera). Manual controls (WASD / sliders) and PID autopilot landing. Uses `three`, `@react-three/fiber`, `@react-three/drei`.
- **API Server** (`artifacts/api-server`, `/api`) — shared Express API. Not used by the simulator.
- **Canvas / Mockup Sandbox** (`artifacts/mockup-sandbox`) — design playground.
