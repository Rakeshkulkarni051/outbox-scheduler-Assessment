# Outbox Scheduler — Full-Stack Email Job Scheduler

A production-grade email scheduling service built as part of the SDE Intern
hiring assignment for **Outbox Labs (ReachInbox.ai)**. The system accepts
email send requests via an API, schedules them for delivery at a specific
time using **BullMQ delayed jobs** (no cron, by design), survives server
restarts without losing or duplicating work, and exposes a dashboard to
create, monitor, and audit scheduled and sent campaigns.

**Live deployment:** available on request — see [Deployment](#deployment)
for the hosting architecture and platform choices.

---

## Table of Contents

- [Assignment Requirements](#assignment-requirements)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Folder Structure](#folder-structure)
- [Database Design](#database-design)
- [Core Design Decisions & Rationale](#core-design-decisions--rationale)
  - [How Scheduling Works](#how-scheduling-works)
  - [How Persistence on Restart Is Handled](#how-persistence-on-restart-is-handled)
  - [How Rate Limiting & Concurrency Are Implemented](#how-rate-limiting--concurrency-are-implemented)
  - [Idempotency](#idempotency)
- [Setup Instructions](#setup-instructions)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Setting Up Ethereal Email](#setting-up-ethereal-email)
  - [Running the Backend](#running-the-backend)
  - [Running the Worker](#running-the-worker)
  - [Running the Frontend](#running-the-frontend)
- [Deployment](#deployment)
- [Features Implemented](#features-implemented)
- [Known Trade-offs & Limitations](#known-trade-offs--limitations)
- [Testing Performed](#testing-performed)
- [Future Enhancements](#future-enhancements)
- [Author](#author)

---

## Assignment Requirements

The assignment specified the following non-negotiable constraints:

- Accept email scheduling requests via an API and persist them to a
  relational database.
- Schedule delivery using BullMQ delayed jobs (or an equivalent Redis/DB
  scheduler) — **no cron jobs, OS-level or library-based, under any
  circumstance**.
- Send emails via Ethereal Email (fake SMTP) from multiple senders.
- Survive server restarts: future scheduled emails must still fire at the
  correct time, and no email may be duplicated or restarted from scratch.
- Support configurable worker concurrency, a minimum delay between
  individual sends, and a configurable emails-per-hour rate limit that is
  safe across multiple worker instances and delays (never drops) jobs that
  exceed it.
- Provide a frontend dashboard with real Google OAuth login, a compose
  flow (including CSV recipient upload), and tables for scheduled and sent
  emails.

This document explains what was built against each of these requirements,
how it was implemented, and why specific technical choices were made over
the alternatives that were considered.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend language | TypeScript | Type safety across API boundaries, DTOs shared conceptually with the frontend |
| Backend framework | Express.js | Explicitly required by the JD; minimal, well-understood routing/middleware model |
| Job queue | BullMQ | Redis-backed, delayed-job-native, production-grade primitive that directly satisfies the "no cron" constraint |
| Queue backing store | Redis (Upstash, hosted) | Required by BullMQ; hosted to avoid a local Docker dependency (see [Deployment](#deployment)) |
| Database | PostgreSQL (Neon, hosted) | Relational integrity for campaign/email state; hosted for the same reason as Redis |
| ORM | Prisma | Type-safe schema-to-client generation, fast migrations under a 48-hour constraint |
| SMTP (dev/test) | Ethereal Email via Nodemailer | Required by the JD; zero-cost disposable inboxes with shareable preview links, ideal for demoing without real delivery risk |
| Auth | Google OAuth via NextAuth (frontend) + `google-auth-library` (backend verification) | Explicitly required to be "real," not mocked |
| Frontend framework | Next.js (App Router) | Server-side auth callback routes required by NextAuth are a first-class fit; fast to ship a dashboard under time pressure |
| Styling | Tailwind CSS | Explicitly permitted by the JD; fastest path to a clean, Figma-adjacent UI |
| CSV parsing | PapaParse | Battle-tested client-side CSV parsing for the recipient-upload flow |

---

## Architecture

```
                     ┌─────────────────┐
                     │   Next.js UI    │
                     │  (Vercel)       │
                     └────────┬────────┘
                              │ HTTPS + Bearer(Google id_token)
                              ▼
                     ┌─────────────────┐
                     │  Express API    │
                     │  (Render)       │──────┐
                     └────────┬────────┘      │
                              │                │ writes
                    enqueues  │                ▼
                    delayed   │        ┌───────────────┐
                    jobs      │        │  PostgreSQL   │
                              ▼        │  (Neon)       │
                     ┌─────────────────┐└───────┬───────┘
                     │  Redis / BullMQ │         │
                     │  (Upstash)      │         │ reconciled on
                     └────────┬────────┘         │ backend startup
                              │ delivers jobs     │
                              ▼                   │
                     ┌─────────────────┐          │
                     │  Worker process │──────────┘
                     │  (Render)       │
                     └────────┬────────┘
                              │ SMTP
                              ▼
                     ┌─────────────────┐
                     │ Ethereal Email  │
                     └─────────────────┘
```

The system is split into three independently deployable processes:

1. **API server** — accepts HTTP requests, writes to Postgres, and enqueues
   BullMQ jobs. Stateless; can be scaled horizontally without any
   coordination logic, since all shared state lives in Postgres/Redis, not
   in process memory.
2. **Worker** — a separate long-running process that consumes BullMQ jobs,
   sends via Ethereal, and updates delivery status. Deliberately decoupled
   from the API server so that scheduling (fast, request/response) and
   sending (slow, rate-limited, I/O-bound) can scale independently — this
   mirrors how real email infrastructure providers separate ingestion from
   delivery.
3. **Frontend** — a Next.js dashboard that talks to the API server only
   over HTTP; it has no direct access to Postgres or Redis.

This is a monorepo with two npm workspaces (`backend/`, `frontend/`)
rather than two separate repositories, since the assignment is a single
cohesive deliverable and a monorepo keeps setup to one `npm install` at
the root.

---

## Folder Structure

```
outbox-scheduler/
├── docker-compose.yml       Local Postgres + Redis (optional — see Setup)
├── backend/
│   └── src/
│       ├── config/          env loading, typed config, Redis connection
│       ├── db/              Prisma client singleton
│       ├── modules/
│       │   ├── schedule/    POST /schedule — dto, service, controller, routes
│       │   ├── emails/      GET /emails/scheduled, /emails/sent
│       │   └── auth/        requireGoogleAuth middleware (id_token verification)
│       ├── queue/
│       │   ├── queues.ts    per-sender BullMQ Queue factory, jobId scheme
│       │   ├── worker.ts    per-sender Worker, rate limiter, min-delay enforcement
│       │   └── reconcile.ts startup reconciliation for crash-safety
│       ├── smtp/            Ethereal/Nodemailer transport wrapper
│       └── server.ts        Express app entrypoint
└── frontend/
    ├── app/                 login page, protected /dashboard, NextAuth route
    ├── components/
    │   ├── ui/               dumb, reusable primitives (Button, Table, Modal, Input)
    │   └── features/          composed feature components (ComposeModal, tables, header)
    ├── hooks/                data-fetching hooks (auth-aware, token-attached)
    ├── lib/api.ts            typed API client, attaches bearer token, handles 401
    └── types/                shared DTOs mirroring the backend Prisma models
```

Each layer has one responsibility: routes never contain business logic,
services never touch `req`/`res`, and the queue layer is entirely unaware
of HTTP. This mirrors a standard controller → service → data-access
separation and keeps the scheduling logic testable independent of Express.

---

## Database Design

**Database:** PostgreSQL, schema managed via Prisma migrations.

### `Sender`
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| email | String (unique) | The "from" address used for this sender's campaigns |
| name | String? | Display name |

### `Campaign`
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| subject | String | Email subject |
| body | String | Email HTML body |
| startTime | DateTime | When this campaign's emails should begin sending |
| delayMs | Int | Minimum delay enforced between consecutive sends for this campaign's sender |
| hourlyLimit | Int | Max emails/hour for this campaign's sender |
| status | String | Campaign-level status |

### `Email`
| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key — also the source of the deterministic BullMQ jobId |
| campaignId | UUID (FK) | Parent campaign |
| senderId | UUID (FK) | Which sender this email is queued under |
| recipient | String | Destination address |
| scheduledTime | DateTime | When this specific email should fire |
| sentTime | DateTime? | When it actually sent |
| status | String | `pending` \| `queued` \| `sent` \| `failed` |
| bullJobId | String? | BullMQ job id, for cross-referencing with the queue |

One `Campaign` fans out into many `Email` rows (one per recipient) at
schedule time. This is the source of truth the system reconciles against
on restart — see below.

---

## Core Design Decisions & Rationale

### How Scheduling Works

When `POST /schedule` is called, the request is validated (Zod schema),
and the service layer performs two steps in a specific order that matters
for correctness:

1. **Write first.** A `Campaign` row and one `Email` row per recipient are
   written to Postgres. This is the system's source of truth — if
   everything after this point fails, the intent to send is not lost.
2. **Enqueue second.** For each `Email` row, a BullMQ job is added to a
   **per-sender queue**, with a `delay` computed as
   `scheduledTime - now`. BullMQ's delayed jobs use Redis's own sorted-set
   primitives internally, so the job simply doesn't become eligible for a
   worker to pick up until its delay elapses — this is what replaces cron
   entirely.

**Why one BullMQ queue per sender**, rather than a single global queue:
OSS BullMQ's `Worker` limiter (`{ max, duration }`) applies at the queue
level, and does not support sub-grouping within a single queue in the open
-source edition. Since the assignment explicitly requires **per-sender**
rate limits with multi-sender support, giving each sender its own queue —
and therefore its own independently configured `Worker` and limiter — was
the design that satisfies the requirement without hand-rolling a
group-aware scheduler on top of a single queue. The trade-off is a queue
(and, on the deployed worker, a `Worker` instance) per sender rather than
one queue total; at the scale this assignment targets, that overhead is
negligible, and it is a pattern that scales linearly with the number of
active senders, not recipients.

### How Persistence on Restart Is Handled

Two independent mechanisms combine to guarantee restart-safety:

1. **Redis already persists the schedule.** A delayed BullMQ job lives in
   Redis, not in the API server's or worker's process memory. Restarting
   either process does not remove or reset jobs already enqueued — the
   worker, on restart, simply re-subscribes to the same queues and Redis
   continues delivering jobs as their delays elapse. This is the
   fundamental property that a cron-based design cannot offer: cron has no
   memory of "this job's timer was already ticking," which is precisely
   why the assignment disallows it.

2. **A reconciliation pass closes the one real gap.** The one window where
   data could be lost is a crash *between* step 1 (DB write) and step 2
   (enqueue) of the scheduling flow above. To close this, `reconcile.ts`
   runs once on every backend startup: it queries Postgres for every
   `Email` row still in `pending` status and re-adds it to its sender's
   queue. This is safe to run unconditionally — including on a normal,
   non-crash restart — because of the idempotency guarantee below, which
   makes re-enqueuing an already-queued job a no-op rather than a
   duplicate.

This was verified directly, not just reasoned about: an email was
scheduled a few minutes out, the worker process was killed mid-wait,
left down for ~15 seconds, and restarted. The email still sent within a
second of its original scheduled time, with no manual intervention.

### How Rate Limiting & Concurrency Are Implemented

**Concurrency** is configured via the `WORKER_CONCURRENCY` environment
variable and passed directly into BullMQ's `Worker({ concurrency })`
option, which controls how many jobs that worker processes in parallel.
No hardcoded values remain in the source.

**Emails-per-hour rate limiting** uses BullMQ's built-in
`limiter: { max, duration }` option, configured per sender queue from that
sender's `Campaign.hourlyLimit` (itself sourced from
`DEFAULT_HOURLY_LIMIT` if unset). This was a deliberate choice over
hand-rolling Redis counters (e.g. `INCR` + `EXPIRE` keyed by
`hour_window:sender`), for two reasons:

- BullMQ's limiter is already Redis-backed internally, so it satisfies the
  "safe across multiple workers/instances" requirement without additional
  code — the counter state lives in Redis, not in any single process.
- When the limit is reached, BullMQ does not fail or drop the job — it
  simply leaves it waiting in the queue until the window allows it
  through. This directly satisfies the requirement that over-limit jobs be
  delayed, not dropped, and it does so without any manual "reschedule into
  the next hour" logic, since the jobs were never removed from the queue
  in the first place.

The trade-off, documented honestly: a hand-rolled sliding-window counter
(e.g. a Redis sorted set pruned with `ZREMRANGEBYSCORE`) would give a
true rolling 60-minute window rather than BullMQ's internal
window-and-reset behavior. For this assignment's scope, the built-in
limiter was judged the better engineering trade-off — reusing a
well-tested library primitive over reimplementing equivalent logic — but
the distinction is worth naming explicitly rather than presenting the
built-in limiter as a sliding window it technically isn't.

**Minimum delay between individual sends** is enforced separately from
the hourly cap, since a sender could be well under its hourly limit and
still send two emails a few milliseconds apart, which the JD explicitly
wants prevented. This is implemented as a small **atomic Redis Lua
script** (`RESERVE_SLOT_SCRIPT` in `worker.ts`) that:

1. Reads the sender's last-reserved send slot from Redis.
2. Computes the next allowed slot as `max(now, lastSlot + minDelayMs)`.
3. Writes that new slot back.
4. Returns it to the caller, which then waits until that slot arrives
   before sending.

This was **not** the first implementation. The first version used a plain
`GET` followed by a `SET` — read the last-sent timestamp, compare, then
write a new one. Under load testing with `WORKER_CONCURRENCY=5`, this
produced a genuine race condition: two jobs running concurrently could
both `GET` the same last-sent value before either had written its update,
so neither job saw the other's reservation, and both sent within the same
millisecond — a clear violation of the minimum-delay requirement. The fix
was to move the read-compute-write sequence into a Redis Lua script,
which Redis guarantees executes atomically; no two jobs can interleave
inside it. Retesting after the fix showed consistent ≥5-second gaps
between sends with no simultaneous pairs, confirmed across multiple runs.
This bug and fix are called out specifically here because it is the one
part of the implementation that did not work correctly on the first pass,
and understanding why is more informative than only describing the
final, working state.

**Behavior under 1000+ emails scheduled at once:** because rate limiting
is enforced by BullMQ's Redis-backed limiter rather than a synchronous
check at schedule time, scheduling a large batch simply adds that many
delayed/waiting jobs to the relevant sender queues — none are rejected or
dropped at write time. As each job becomes eligible, the limiter admits it
to a worker only if the sender's current hourly/min-delay budget allows
it; anything over budget continues waiting in the same queue rather than
being requeued elsewhere or discarded. This means throughput under a large
burst is bounded by the configured limiter, not by the size of the burst
itself.

### Idempotency

Every enqueued job uses a **deterministic BullMQ job id**:
`email-<Email.id>`. BullMQ treats `queue.add()` calls with an id that
already exists in the queue as a no-op — it will not create a duplicate
job. This means the reconciliation pass described above can run on every
single startup, crash-triggered or not, without any risk of double-
scheduling: if a job for a given email is already present, re-adding it
changes nothing.

As a second, independent safeguard, the worker itself checks the `Email`
row's status before sending: if it is already `sent` or `failed`, the job
is skipped. This protects against the (currently theoretical, given the
above) case of the same job somehow being processed twice.

---

## Setup Instructions

### Prerequisites

- Node.js 20+
- npm
- A PostgreSQL instance (a free [Neon](https://neon.tech) project is the
  fastest path if Docker isn't available locally)
- A Redis instance (a free [Upstash](https://upstash.com) database works
  the same way; note Upstash requires `rediss://`, not `redis://`)
- An Ethereal Email account (see below)
- A Google Cloud OAuth 2.0 Web Client ID (for login)
- Docker (optional — `docker-compose.yml` is provided for local Postgres +
  Redis, but is not required; this project was developed and deployed
  entirely against hosted Neon + Upstash instances instead)

### Environment Variables

**`backend/.env`**
```env
DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?sslmode=require"
REDIS_URL="rediss://default:<password>@<host>:6379"
PORT=4000
ETHEREAL_USER=
ETHEREAL_PASS=
DEFAULT_HOURLY_LIMIT=200
MIN_DELAY_MS=2000
WORKER_CONCURRENCY=5
GOOGLE_CLIENT_ID=
```

**`frontend/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

`GOOGLE_CLIENT_ID` must be identical on both sides — the frontend uses it
(with the secret) to run the OAuth flow via NextAuth; the backend uses it
alone, via `google-auth-library`, to verify that an incoming request's
`id_token` was actually issued for this application (`aud` claim check),
rather than trusting any arbitrary Google-signed token.

In Google Cloud Console → APIs & Services → Credentials, the OAuth client
needs these Authorized redirect URIs:
```
http://localhost:3000/api/auth/callback/google
https://outbox-scheduler-assessment-fronten.vercel.app/api/auth/callback/google
```

### Setting Up Ethereal Email

Ethereal is a disposable fake-SMTP service intended exactly for this kind
of test scenario — nothing is actually delivered, but a shareable preview
link is generated per message, which is used throughout this project to
verify sends without any real email risk.

1. Visit https://ethereal.email/create
2. Copy the generated username and password into `ETHEREAL_USER` /
   `ETHEREAL_PASS` in `backend/.env`
3. No further configuration is required — `backend/src/smtp/ethereal.ts`
   is pre-configured for Ethereal's SMTP host/port

### Running the Backend

```bash
# from the repository root
npm install          # installs both backend/ and frontend/ workspaces

cd backend
npx prisma migrate dev --name init
npm run dev           # starts the Express API on PORT (default 4000)
```

Verify: `GET http://localhost:4000/health` should return `{"ok": true}`.

### Running the Worker

The worker is a **separate process** from the API server — both must be
running for scheduled emails to actually send.

```bash
cd backend
npm run worker
```

On startup, this process reads all existing `Sender` rows, starts one
BullMQ `Worker` per sender (with that sender's configured concurrency,
hourly limit, and min delay), and begins consuming jobs as their delays
elapse.

### Running the Frontend

```bash
cd frontend
npm run dev            # starts Next.js on http://localhost:3000
```

Sign in with Google, and you will land on `/dashboard`, which is a
protected route (enforced by `frontend/middleware.ts`).

---

## Deployment

The system is deployed across three free-tier services, chosen
specifically to avoid a Docker/local-infrastructure dependency:

| Service | Platform | Reasoning |
|---|---|---|
| PostgreSQL | [Neon](https://neon.tech) | Free-tier hosted Postgres, no local install required |
| Redis | [Upstash](https://upstash.com) | Free-tier hosted Redis with TLS, no local install required |
| API server | [Render](https://render.com) (Web Service) | Binds to Render's injected `PORT`; deploys directly from the `backend/` workspace |
| Worker | [Render](https://render.com) (Web Service) | Render's free tier does not offer its dedicated "Background Worker" service type without a paid plan; the worker process instead runs as a Web Service with a minimal Express server bound only to answer `GET /health`, satisfying Render's port-binding health check while the real work happens via BullMQ, entirely independent of HTTP traffic |
| Frontend | [Vercel](https://vercel.com) | First-class Next.js support, including the server-side API routes NextAuth requires for the OAuth callback |

**Note on the worker's free-tier hosting:** Render's free Web Services
spin down after ~15 minutes of no HTTP traffic. Because the worker's real
job (processing delayed BullMQ jobs) has nothing to do with HTTP traffic,
an idle worker could in principle miss its wake-up window for a
precisely-timed send. In production this would be solved by moving to a
paid "Background Worker" service type (no port/traffic requirement at
all); for this assignment, the free-tier constraint is mitigated by an
external uptime monitor pinging the worker's `/health` endpoint every few
minutes, keeping it warm.

`docker-compose.yml` remains in the repository for local Postgres + Redis,
for anyone reviewing this project who does have Docker available and
prefers not to depend on third-party free tiers.

---

## Features Implemented

### Backend

| Requirement | Status | Notes |
|---|---|---|
| Scheduling API | ✅ | `POST /api/schedule` |
| Relational DB persistence | ✅ | PostgreSQL via Prisma |
| BullMQ delayed jobs, no cron | ✅ | Per-sender queues |
| Multi-sender Ethereal sending | ✅ | `GET /api/senders` powers sender selection |
| Restart-safe persistence | ✅ | Verified by killing/restarting the worker mid-wait |
| No duplicate sends (idempotency) | ✅ | Deterministic jobId + DB status guard |
| Configurable concurrency | ✅ | `WORKER_CONCURRENCY` |
| Configurable min delay between sends | ✅ | Atomic Redis Lua script, race-condition-tested |
| Configurable, multi-worker-safe hourly rate limit | ✅ | Per-sender BullMQ limiter (Redis-backed) |
| Over-limit jobs delayed, not dropped | ✅ | Inherent to BullMQ's limiter behavior |
| Google OAuth verification | ✅ | `requireGoogleAuth` middleware on all protected routes |

### Frontend

| Requirement | Status | Notes |
|---|---|---|
| Real Google OAuth login | ✅ | NextAuth, JWT session strategy |
| Protected dashboard route | ✅ | `middleware.ts` |
| Header with name/email/avatar/logout | ✅ | Sourced from the live session |
| Scheduled emails table | ✅ | Loading + empty states |
| Sent emails table | ✅ | Loading + empty states |
| Compose flow | ✅ | Subject, body, sender selection, start time, delay, hourly limit |
| CSV recipient upload | ✅ | PapaParse, shows parsed recipient count |
| Session-expiry handling | ✅ | API client forces sign-out on a 401 response, rather than leaving a stale/broken dashboard |

---

## Known Trade-offs & Limitations

Documented here deliberately rather than left silent, in the interest of
being precise about what this implementation does and does not fully
cover:

- **A running worker does not pick up a mid-flight change to a sender's
  rate limit or delay.** `hourlyLimit`/`delayMs` are read once, at worker
  startup, from that sender's most recent campaign. If a second campaign
  is created for the same sender with different limits while the worker
  is already running, the new limits will not take effect until the
  worker restarts. Fixing this properly would mean either restarting the
  relevant `Worker` instance on every new campaign for that sender, or
  moving the limiter check out of BullMQ's built-in option and into
  custom per-job logic that reads the campaign fresh each time — the
  latter would also sacrifice some of the built-in limiter's simplicity.
- **The built-in BullMQ limiter is not a true sliding window** — see the
  rate-limiting section above for the explicit distinction and reasoning.
- **No automated test suite.** Given the 48-hour window, verification was
  performed through direct, repeatable manual testing (documented in
  [Testing Performed](#testing-performed)) rather than an automated suite.
  This would be the first addition in a follow-up iteration.
- **The worker's free-tier hosting on Render** requires an external
  keep-warm ping, as explained in [Deployment](#deployment).

---

## Testing Performed

The following was verified directly against the running system, not just
asserted:

1. **End-to-end scheduling** — `POST /api/schedule` confirmed to write a
   `Campaign` and per-recipient `Email` rows to Postgres and enqueue
   corresponding BullMQ jobs (verified via response payload and
   `GET /api/emails/scheduled`).
2. **Actual delivery** — a scheduled email was confirmed to send via the
   worker's log output and an Ethereal preview URL showing the rendered
   message.
3. **Scheduling accuracy** — a job scheduled ~9 minutes ahead fired within
   one second of its target time.
4. **Restart survival** — an email was scheduled a few minutes out, the
   worker process was killed entirely, left down for ~15 seconds, then
   restarted. It still sent on time with no data loss or duplication.
5. **Min-delay enforcement under concurrency** — three emails enqueued
   simultaneously with a 5-second minimum delay were sent 7.5 and 5.3
   seconds apart respectively, with no simultaneous pair — this test is
   what surfaced and confirmed the fix for the race condition described
   above.
6. **Full live flow** — Google login, campaign composition, scheduling,
   and delivery were all exercised end-to-end against the deployed
   Vercel + Render + Neon + Upstash stack, not just locally.

---

## Future Enhancements

If this project continued past the assignment scope, the natural next
steps would be:

- A hand-rolled Redis sorted-set sliding-window rate limiter as a
  documented alternative to BullMQ's built-in limiter, for teams that need
  a true rolling window rather than a fixed one.
- Live-reloading a sender's rate limit/delay without a worker restart.
- An automated test suite (unit tests for the scheduling service and the
  min-delay Lua script's logic; integration tests for the restart-
  reconciliation flow).
- Moving the worker to a paid Background Worker tier (or an always-on VM)
  to remove the free-tier keep-warm dependency entirely.
- Pagination for the scheduled/sent tables once campaign volume grows
  beyond a single page.
- Structured logging/observability (the current `logger.ts` is
  intentionally minimal — JSON-line console output — and would be the
  first thing swapped for something like Pino with a real log sink in a
  production deployment).

---

## Live Deployment

- Frontend (dashboard): https://outbox-scheduler-assessment-fronten.vercel.app
- Backend API: https://outbox-scheduler-assessment-2.onrender.com
- Worker service: https://outbox-scheduler-assessment-worker-serv.onrender.com

> Note: the backend and worker run on Render's free tier, which spins down
> after ~15 minutes of inactivity. The first request after idle time may
> take 30–60 seconds to respond while the service wakes up — this is a
> hosting-tier characteristic, not an application defect.

---

## Author

Rakesh Kulkarni
SDE Intern Candidate — Outbox Labs (ReachInbox.ai)

Thank you for reviewing this submission — I'm happy to walk through any of
the architectural decisions above in more depth during a technical
discussion.