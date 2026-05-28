# BioMusic

Music that adapts to your body in real time. BioMusic reads biometric signals
(heart rate, HRV, stress, focus, EEG) and steers your soundtrack toward your
optimal **flow state** for workouts, focus, sleep, and more.

This is an npm-workspace monorepo with a hybrid backend. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full system design.

## Workspaces

| Path | Package | What it is |
|------|---------|------------|
| `/` | `@biomusic/web` | React + Vite PWA (Capacitor for native) |
| `packages/core` | `@biomusic/core` | Shared, pure-TS adaptive engine + API contracts |
| `services/adaptive` | `@biomusic/adaptive` | Stateless Hono service (recommendations, AI, providers) |
| `supabase/` | — | v2 schema migration + edge functions |

## Prerequisites

- Node 22+
- A Supabase project (Auth + Postgres)

## Setup

```bash
npm install                       # installs all workspaces

# Web app config
cp .env.example .env              # fill in Supabase URL + publishable key

# Adaptive service config
cp services/adaptive/.env.example services/adaptive/.env
```

Apply the database schema to your Supabase project (fresh project recommended):

```bash
supabase db reset                 # runs supabase/migrations/*.sql
```

## Develop

```bash
npm run dev                       # web app on http://localhost:8080
npm run dev:service               # adaptive service on http://localhost:8787
```

The web app works without the service running — it falls back to the
deterministic engine bundled in `@biomusic/core`.

## Quality gates

```bash
npm run typecheck                 # web app
npm run build:core                # type-check the shared package
npm run build:service             # type-check + bundle the service
npm test                          # unit tests (core engine + service)
npm run build                     # production web build
```

## Deploy

- **Web:** static build (`npm run build`) to any CDN/static host. PWA-installable.
- **Service:** container (`services/adaptive/Dockerfile`) to Cloud Run / Fly /
  Render. Build from the repo root:
  ```bash
  docker build -f services/adaptive/Dockerfile -t biomusic-adaptive .
  ```
- **Database + Edge Functions:** Supabase (`supabase db push`,
  `supabase functions deploy`).

## Generating typed DB types (optional)

The web client types Supabase results at the API boundary. For end-to-end
generic typing, generate types and pass them to `createClient<Database>`:

```bash
supabase gen types typescript --project-id <id> > src/lib/database.types.ts
```
