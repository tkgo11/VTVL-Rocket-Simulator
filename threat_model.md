# Threat Model

## Project Overview

This project is a pnpm TypeScript monorepo for a multiplayer VTVL rocket landing simulator. The production application consists of a React/Vite browser client in `artifacts/vtvl-sim`, an Express 5 REST API and `ws` WebSocket backend in `artifacts/api-server`, and PostgreSQL persistence through Drizzle in `lib/db`. Users may play as guests or register accounts with custom email/password authentication. The API stores users, sessions, rooms, room players, runs, and leaderboard entries.

The mockup sandbox in `artifacts/mockup-sandbox` is a development-only playground and is not considered production-reachable. In production, `NODE_ENV` is assumed to be `production`, the deployment platform provides TLS, and Replit manages environment secrets such as `DATABASE_URL`.

## Assets

- **User accounts and sessions** -- registered users' emails, usernames, password hashes, session cookies, and session tokens. Compromise allows account impersonation and access to private run history.
- **Leaderboard and run data** -- submitted scores, grades, mission IDs, and flight statistics. Integrity matters because public rankings should not be trivially forged or spammed.
- **Room state and multiplayer authority** -- room codes, host secrets, reconnect secrets, ready state, round results, and live rocket telemetry. Compromise can disrupt rooms, impersonate players, or manipulate round outcomes.
- **Application secrets and database contents** -- `DATABASE_URL`, stored session tokens, password hashes, and persisted room secrets. Leakage can allow database access or session hijacking.
- **Service availability** -- public REST and WebSocket endpoints must remain responsive despite unauthenticated traffic and game telemetry volume.

## Trust Boundaries

- **Browser to API** -- all REST requests and WebSocket messages originate from untrusted clients. The server must validate authentication, authorization, message shape, and resource consumption.
- **API to PostgreSQL** -- the backend uses Drizzle ORM with PostgreSQL. Queries must remain parameterized and must not expose sensitive tables or overbroad data.
- **Public to authenticated user boundary** -- guest play, room discovery by code, leaderboard viewing, account registration, and login are public. Account identity, private run history, and session actions require a valid session.
- **Room participant to host boundary** -- room members and spectators can join by room code, but only the verified host should start rounds or exercise host authority.
- **Client score calculation to server persistence** -- the browser calculates flight outcomes, but the server persists leaderboard and multiplayer results. Server-side controls must protect public ranking integrity from forged client payloads.
- **Development to production boundary** -- `artifacts/mockup-sandbox`, scripts, local dev origins, and Vite dev plugins should not be treated as production attack surface unless proven production-reachable.

## Scan Anchors

- Production API entry points: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, and REST route files under `artifacts/api-server/src/routes/`.
- WebSocket entry point and room authority: `artifacts/api-server/src/lib/websocket.ts` and `artifacts/api-server/src/lib/roomManager.ts`.
- Authentication/session storage: `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/lib/sessionStore.ts`, `artifacts/vtvl-sim/src/contexts/PlayerContext.tsx`, and `artifacts/vtvl-sim/src/lib/api.ts`.
- Database schema and trust-sensitive persisted fields: `lib/db/src/schema/index.ts` and `lib/db/src/index.ts`.
- Client/server score submission paths: `artifacts/api-server/src/routes/leaderboard.ts`, `artifacts/vtvl-sim/src/pages/Simulator.tsx`, and `artifacts/vtvl-sim/src/pages/MultiplayerSimulator.tsx`.
- Dev-only areas normally out of scope: `artifacts/mockup-sandbox`, local scripts, generated client code unless it affects production API behavior, and Vite dev plugins gated by non-production `NODE_ENV`.

## Threat Categories

### Spoofing

Users authenticate via custom email/password sessions. Session tokens must be unpredictable, protected from script access where possible, expired consistently, and validated on every protected REST and WebSocket action. Room host and reconnect authority must be based on server-issued secrets, not client-supplied player IDs alone.

### Tampering

All client-supplied game data, scores, grades, room roles, readiness, mission IDs, and telemetry are untrusted. Public leaderboard entries and multiplayer round results must not rely solely on client-side calculations when integrity matters. Database writes must use parameterized ORM operations and server-side validation.

### Information Disclosure

The API must not return password hashes, raw session data, host secrets, reconnect secrets, or private run histories to unauthorized clients. Logs must redact cookies, authorization headers, session tokens, and sensitive errors. Public endpoints may expose leaderboard/profile data only when intentionally public.

### Denial of Service

Public login, registration, room creation, run submission, leaderboard reads, and WebSocket message handling are reachable without authentication. These paths must enforce rate limits, payload size limits, bounded message frequency, and inexpensive validation to prevent brute force, spam, CPU exhaustion, database growth, or large WebSocket payload parsing.

### Elevation of Privilege

Authenticated users must only access their own private run history, guests must not claim another guest's reconnect slot, and non-host room participants must not start rounds. Any future admin or moderation features must enforce roles server-side. SQL injection, command injection, path traversal, and unsafe dynamic code execution should remain absent from production code.