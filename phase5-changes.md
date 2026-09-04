# Phase 5 — legacy cutover

The dashboard and agent move onto the derived pipeline. **Nothing is deleted that
can't be walked back with a config flip** — legacy endpoints stay mounted, the
`monitoring_activities` / `monitoring_enrollments` tables stay in place, and the
agent keeps a `PIPELINE_MODE=legacy|dual` revert path.

`CONTENT_CAPTURE_LEGALLY_APPROVED` is untouched (still `false`).

---

## ⚠️ Sequencing — do this before you roll the new agent build

You said: don't freeze the legacy path until the **live dashboard-vs-real-day
check** and the **real-Windows QA** (lock / sleep / forced power-off / reboot)
both pass on your machine.

This code makes the agent default to **events-only**. So:

1. Keep your **current dual-emitting agent** running until the precondition passes.
2. Run the verification below against derived data.
3. Only then package / deploy this agent build (default `events`), and treat the
   legacy endpoints as frozen.

If you want a belt-and-braces transition window, ship this build with
`PIPELINE_MODE=dual` first (both paths), confirm derived data matches, then drop
to `events`.

---

## What changed

### Frontend — derived data only
| File | Change |
|---|---|
| `src/pages/monitoring/monitoringUtils.js` | Removed `groupByEmployee`, `groupByApplication`, `summarise`, `deriveStatus`, `isToday`, `ACTIVITY_TYPES`, `TYPE_META`. Kept formatters + derived-response helpers (`summaryStatus`, `INTERVAL_META`, `SCREEN_OFF_REASON_LABEL`, `formatHm`, …). |
| `src/pages/monitoring/MonitoringSummary.jsx`, `MonitoringFilters.jsx` | **Deleted** — orphaned, nothing imported them. |
| `src/api/monitoring.js` | Removed `listMonitoringActivities`. The UI now calls only `getMonitoringSummary` (`/summary`), `getMonitoringDay` (`/daily`), plus the agents + content endpoints. |

Confirmed no remaining references (grep + `vite build`). `MonitoringCard`, `MonitoringDayDetail`, `MonitoringTimeline`, `Monitoring`, `ManageDevicesModal` were already on `/summary` + `/daily`.

### Agent — stops dual-emitting
| File | Change |
|---|---|
| `src/config/config.js` | New **`pipelineMode`**: `"events"` (default) \| `"dual"` \| `"legacy"`. Env `PIPELINE_MODE`, or `pipelineMode` in `agent.config.json` / the setup fallback. Derives `eventsPipelineEnabled` + `legacyActivitiesEnabled`. `EVENTS_PIPELINE_ENABLED=false` is honoured as a hard override → `legacy`. The agent is **never left blind** (events off ⇒ legacy on). |
| `src/monitoring/tracker.js` | The legacy `ActivityReporter` (POST `/agent/activities`) is created **only** when `legacyActivitiesEnabled`. In default `events` mode it's `null`: the session tracker still runs for the local "Active application" logs, but nothing is POSTed to `/activities`. |

`npm run agent` (headless) and the Electron app both respect `pipelineMode`.

### Backend — freeze, don't delete
| File | Change |
|---|---|
| `controllers/monitoringController.js` | `submitMonitoringActivities` + `getMonitoringActivities` now set `Deprecation: true` / `Sunset` / `Warning` headers and log a rate-limited `[monitoring] deprecated legacy endpoint used: …` (once/hour). Handlers otherwise unchanged. **Removed** `createMonitoringEnrollment` + `enrollMonitoringAgent` (token self-enroll — never used by the agent, which enrols dashboard-side via `POST /agents`). |
| `routes/monitoringRoute.js` | Removed `POST /enrollments` and `POST /agent/enroll` (now 404). `/agent/activities` + `/activities` stay mounted, marked deprecated. |

`monitoring_activities` and `monitoring_enrollments` tables + models are **untouched** — historical data stays queryable, and a reverted agent still writes activities.

### Env config — the deploy blocker
| File | Change |
|---|---|
| `config/config.js` | `development` / `test` read `DB_*`. `production` **prefers `PROD_DB_*` and falls back to `DB_*`** when they're not set — plain objects, **no throw**, so an existing deploy that only sets `DB_*` keeps working. A `NODE_ENV=production` boot with no `PROD_DB_HOST` logs a warning. (An earlier draft of this file threw on missing `PROD_DB_*`; that was walked back — see the 2026-09-03 hotfix note below — because it can take down a working deploy, and hosts that co-locate MySQL legitimately use `DB_HOST=localhost`.) |
| `config/db.js` | Now consumes `config/config.js` keyed by `NODE_ENV` (was reading `process.env.DB_*` directly). Startup log shows which env + host it connected to. |
| `package.json` | `migrate` → dev (`sequelize-cli db:migrate`, no `--env production`). New `migrate:prod`, `migrate:undo`, `migrate:status`. `start` → `npm run migrate:prod && node index.js` (unchanged shape from before). `dev` unchanged. |
| `.env.example` | Documents the `DB_*` (local) vs optional `PROD_DB_*` (deploy) split. |

**Deploy:** `npm start` runs the prod migration then boots, exactly as before. To keep prod and dev credentials distinct, set `PROD_DB_*` in the hosting environment — but it is **optional**; without it, prod uses `DB_*`.

### 2026-09-03 hotfix — production outage

The stricter `config/config.js` (throw on missing `PROD_DB_*`, via a lazy getter) was deployed and **took production down (503)**: the hosting env had `DB_*` set, not `PROD_DB_*`, so `npm start` → `migrate:prod` accessed `config.production` → threw → the Node app never booted → Hostinger served its own 503 page (which, having no `Access-Control-Allow-Origin`, surfaced in the browser as a *CORS* error on `/api/auth/login`). Fix: `config.production` now falls back to `DB_*` and never throws; `scripts/start.js` (which forced `NODE_ENV=production`) was removed. **Redeploy the backend to recover.**

---

## Test status

```
Backend  (node --test)   77 / 77   pass
Agent    (node --test)   46 / 46   pass   (+7  config.test.js — pipelineMode matrix)
Frontend (vite build)    clean
```

Live-verified: removed routes → 404; `/agent/activities` + `/activities` → `Deprecation`/`Sunset` headers + server warn; `config.production` falls back to `DB_*` (warns, does not throw); `migrate:prod` + dev DB connect; migrations all `up`.

---

## One-time verification — legacy path is fully unused

Run this once, after the precondition passes and the new agent build is running
for **a full working day** on at least one real machine.

### A. Agent is not writing legacy activities
1. In the agent log, confirm the startup line reads `pipeline=events [events]` — **no** `[legacy /activities]`.
2. Server: `SELECT MAX(created_at) FROM monitoring_activities WHERE agent_id = <that agent>;` — the timestamp is **before** the new build started. Re-check after a few hours: unchanged.
3. Server logs: no `[monitoring] deprecated legacy endpoint used: POST /api/monitoring/agent/activities` lines appear after the new build started.
4. Optional network check: on the agent host, nothing hits `POST /api/monitoring/agent/events` **and** `POST /api/monitoring/agent/activities` — only the former.

### B. Dashboard renders purely from derived data for a full day
1. Pick yesterday (a complete day). Open Monitoring → the employee card, then the day detail.
2. In browser DevTools → Network, filter `monitoring`: you should see **only** `GET /monitoring/summary` and `GET /monitoring/daily` (plus `/agents`, and `/content` → 403). **No** `GET /monitoring/activities`.
3. Cross-check the numbers against the raw events for that (agent, day):
   - `first_pc_on` / `final_pc_off` ≈ first/last event `occurred_at`.
   - `active + idle + screen_off + untracked == total_seconds` (± a few s) on each device section (the panel prints this line).
   - Top apps / domains on the card match what you actually used.
4. `SELECT * FROM monitoring_recompute_queue WHERE status = 'error';` → empty.

### C. Endpoints are frozen, not broken
- `curl -i` `POST /api/monitoring/agent/activities` (valid creds, `activities: []`) → `201` **with** `Deprecation: true` and `Sunset:` headers.
- `POST /api/monitoring/enrollments` and `POST /api/monitoring/agent/enroll` → `404`.

If A, B, and C all hold, the legacy path is dead weight and can be scheduled for
removal (tables included) in a later phase.

---

## Revert procedure — re-enable dual-emit

No redeploy of the backend is needed; the legacy endpoints never left.

### Fast revert (one agent / testing)
Set an env var (or `agent.config.json`) and restart the agent:
```
PIPELINE_MODE=dual      # both paths — safest, lets you compare
# or
PIPELINE_MODE=legacy    # legacy only — full rollback to pre-Phase-2 behaviour
```
- `dual`: agent resumes `POST /agent/activities` **and** keeps the event pipeline.
- `legacy`: agent sends only `/agent/activities`; event pipeline off.
- The agent log line will show `[legacy /activities]` again.

### Fleet revert (packaged agents)
The packaged build reads `PIPELINE_MODE` from the environment / `agent.config.json`
next to the exe. Push `PIPELINE_MODE=dual` via whatever config channel the install
uses and restart the agents. No new build required if the env is readable at
launch; otherwise ship a build with `pipelineMode: "dual"` in the bundled
`agent.config.json`.

### Dashboard revert (show the old activity view again)
The old client-side grouping was deleted. If you need the raw-activity view back:
`git revert` the frontend commit for Phase 5 (restores `MonitoringSummary.jsx`,
`MonitoringFilters.jsx`, the `monitoringUtils` helpers, and `listMonitoringActivities`).
`GET /monitoring/activities` still works, so the reverted UI is immediately
functional.

### Backend / DB
Nothing to revert — `monitoring_activities` and `monitoring_enrollments` are
intact. The env-config change is backward compatible: a deploy that only sets
`DB_*` keeps working; `PROD_DB_*` is an optional override.
