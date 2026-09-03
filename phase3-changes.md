# Phase 3 — real screen-state + reliability hardening

Scope delivered: powerMonitor lock/sleep in the screen_state stream, the
persistent display-power watcher (perf rework), reboot/agent-restart stitching
confirmation + tests, the agent revoke endpoint + dashboard UI, and agent
liveness on the events ingest. Legacy `/activities` stays dual-emitting; the
content/legal gate stays `false` (untouched).

---

## Files changed

| File | What |
|---|---|
| `Task-Monitoring-Agent/src/monitoring/screenReducer.js` | **Rewritten.** Folds `displayOff` + `locked` + `suspended` into one on/off state + a reason set. Emits a transition on every real change **including a reason-set shift while the screen stays off** (§2a). `primaryReason()` precedence `reboot > sleep > locked > display_off` — identical to the backend. |
| `Task-Monitoring-Agent/src/monitoring/displayPowerWatcher.js` | **New.** One long-lived PowerShell process that registers `RegisterPowerSettingNotification(GUID_SESSION_DISPLAY_STATUS)` and streams one line per change. `current()` is read synchronously by the poll — no per-tick spawn. Fails open; auto-restarts the helper with capped backoff; `taskkill /T /F` on stop so no orphan PowerShell. |
| `Task-Monitoring-Agent/src/monitoring/tracker.js` | Uses the watcher instead of `getScreenState()` per poll. `startActivityTracking()` now returns **`notifyPowerState({locked?, suspended?})`**. Watcher `onChange` drives the reducer at event granularity; the poll's `applyDisplay` call is a reconciliation net. **Legacy idle rule unchanged: `idleNow = screen.displayOff` only** — lock/sleep never touch the `/activities` path. `screen_state` payload now carries `reasons[]` when off. |
| `Task-Monitoring-Agent/src/main.js` | Wires Electron `powerMonitor` (`lock-screen` / `unlock-screen` / `suspend` / `resume`, + a harmless `shutdown` log) → `monitoring.notifyPowerState(...)`. Attached once, from `startMonitoring()`, only when the events pipeline is enabled. Windows shutdown/restart still flows through the existing `app` `session-end` handler. |
| `Task-Monitoring-Agent/src/config/config.js` | `DEFAULT_ACTIVITY_POLL_INTERVAL_SECONDS` **5 → 15**. Display power is now a notification stream, so the poll no longer has to be fast. `ACTIVITY_POLL_INTERVAL_SECONDS` still overrides. |
| `Task-Monitoring-Agent/src/monitoring/screenState.js` | Marked **deprecated** (still present for ad-hoc diagnostics; off every hot path). |
| `Task-Monitoring-Agent/test/screenReducer.test.js` | **New.** 8 tests: reason precedence, on/off edges, §2a lock-on-top-of-display-off, suspend outranking, no spurious "on" across a display→lock handoff, init state, ignored fields. |
| `Task-Manager-Backend/controllers/monitoringController.js` | **`listMonitoringAgents`** (GET) + **`revokeMonitoringAgent`** (POST). `submitMonitoringEvents` now also updates the agent row's `last_heartbeat_at` / `current_run_id` / `last_os_boot_time` from the newest event in the batch (best-effort, never rewinds, never fails the request). |
| `Task-Manager-Backend/routes/monitoringRoute.js` | `GET /api/monitoring/agents`, `POST /api/monitoring/agents/:id/revoke` — both `requireAuth` + `requireRole("owner","admin")`. |
| `Task-Manager-Backend/test/monitoringDerivation.test.js` | +2 tests: run change with an `os_boot_time` delta just **under** the 5-min tolerance → `untracked` (agent restart); just **over** → `screen_off/reboot`. |
| `Task-Manager-Frontend/src/api/monitoring.js` | `listMonitoringAgents()`, `revokeMonitoringAgent(id)`. |
| `Task-Manager-Frontend/src/pages/monitoring/ManageDevicesModal.jsx` | **New.** Owner/admin drawer: every enrolled agent (device, employee, platform, version, last heartbeat), **Revoke** with a confirm dialog. |
| `Task-Manager-Frontend/src/pages/monitoring/Monitoring.jsx` | "Manage Devices" button in the header (owner/admin), renders the modal, refreshes the summary on revoke. |

**Not changed:** the derivation engine's reboot/tolerance logic (already correct — `REBOOT_OS_DELTA_MS = 5 min`, `os_boot_time` fixed once per run in the agent's `events.js`); `MonitoringDayDetail.jsx` (already renders `unclean_shutdown`, the "last heartbeat (unclean)" hint, and `locked`/`sleep`/`reboot` reason labels); the content-capture gate / consent / legal flags; DB schema (the `reasons` JSON column already exists from migration `20260903120200`).

---

## Behaviour notes / limitations

- **Lock & sleep are Electron-only.** `powerMonitor` needs the Electron runtime, so `npm run agent` (headless) will **not** emit `locked` / `sleep` reasons — it still emits `display_off` from the watcher. QA the lock/sleep items with `npm start` or the packaged build.
- **Reason-set changes while off split the interval.** Lock-on-top-of-display-off produces `screen_state` off events `[display_off]` → `[locked, display_off]` → `[display_off]`; the backend renders that as three adjacent screen-off rows (one `Locked`), one continuous screen-off *period*. This is the fix verified green last round.
- **Suspend emit may not flush before sleep.** The `screen_state suspend` event is written to the local JSONL queue synchronously (crash-safe) but the HTTP flush usually lands on resume. Derivation is unaffected — it works off `occurred_at`.
- **Watcher transition granularity** ≈ 200 ms (the PS DoEvents loop). On/off boundaries are event-accurate, not poll-accurate.
- **Poll 15 s → legacy `/activities` regression surface.** `monitoring_activities` session start/end can now be up to ~15 s coarse (was ~5 s). Sub-15s app focus flickers are more likely to be absorbed into the neighbouring session. The **events pipeline is unaffected** (screen edges come from the watcher; app focus is still sampled each poll but the derivation stitches spans). See QA §7.
- **Revoke is a soft flip** (`status = 'revoked'`). The agent finds out on its next heartbeat/events call (401 → clears stored creds, disables auto-start, shows setup). No push; worst case one heartbeat interval (~30 s) of extra data.

---

## Automated test status

```
Backend  (node --test)   50 / 50  pass
Agent    (node --test)   25 / 25  pass   (+8 screenReducer)
Frontend (vite build)    clean
```

Integration-smoked locally (not committed): `DisplayPowerWatcher` against the real
Windows power API (spawns, reports `determined:true`, stops with no orphan), and
`startActivityTracking().notifyPowerState(...)` → the expected `screen_state`
event sequence in the queue.

---

# Windows QA checklist

Run on a **real Windows box** with a physical monitor. Use the Electron app, not
headless: `cd Task-Monitoring-Agent && npm start` (or the packaged build).
Point it at a backend you can query. Keep the backend's
`GET /api/monitoring/daily?user_id=<id>&date=<today>` and the dashboard
day-detail page open in a browser to check results.

Prep:
- [ ] Agent enrolled, tray shows "monitoring running", one clean `agent_start` in `monitoring_events`.
- [ ] `EVENTS_PIPELINE_ENABLED` unset or `true`.
- [ ] Note the current `os_boot_time` (from any recent event) and `run_id`.

### 1. Persistent display watcher — no PowerShell storm
- [ ] Open Task Manager → Details, sort by name. With the agent idle-polling, there is **at most one** transient `powershell.exe` per 15 s (active-window/domain), **not** a second one every few seconds for display power.
- [ ] Agent log shows `Display power watcher started (persistent power-setting notification)` exactly once per monitoring start.
- [ ] Let the monitor sleep via power plan (or press the monitor's power button). Agent log: `screen_state` off / `Display turned off`. Wake it: `screen_state` on within ~1 s (not up to 15 s).
- [ ] Kill the watcher's `powershell.exe` from Task Manager. Log: `helper exited — restarting`; a new one appears within a few seconds; display state still tracked afterwards.

### 2. Win+L (lock) — tracked as screen-off/locked, monitor still on
- [ ] Foreground an app, then press **Win+L**. Wait 2 min. Unlock.
- [ ] `monitoring_events`: `screen_state {state:"off", reason:"locked", reasons:["locked"]}` at lock, `{state:"on"}` at unlock.
- [ ] Day detail: a **Screen-off period** labelled **Locked** for the locked span. Active time does **not** include it.
- [ ] Legacy `monitoring_activities`: the lock span is an **idle** row **only if the monitor also powered off** during it (screensaver/timeout). Pure lock with monitor on → the legacy path keeps the app session (no regression — legacy idle = display off only).

### 3. Lock, then let the monitor time off (reason-set merge, §2a)
- [ ] Press Win+L. Leave it until the monitor powers off (or force monitor off after locking). Wait. Turn the monitor on, unlock.
- [ ] `screen_state` sequence: `["locked"]` → `["locked","display_off"]` → (on unlock, monitor still off briefly) `["display_off"]` → `{state:"on"}`.
- [ ] Day detail: **one continuous screen-off period**, split into adjacent rows — a `Locked` row then a `Display off` row. `screen_off_period_count = 1`. 4-way invariant holds (`active + idle + screen_off + untracked = total`).

### 4. Sleep / resume (S3) — screen-off/sleep, not untracked
- [ ] Start → Sleep (or lid close). Leave ≥ 3 min. Wake.
- [ ] `screen_state {reason:"sleep"}` recorded at suspend (may arrive on the flush after resume — fine).
- [ ] Day detail: the sleep span is **Screen off → Sleep**, **not** an "Untracked gap". `untracked_seconds` unchanged by this.
- [ ] Heartbeats resume after wake; `run_id` **unchanged** (same process); no `reboot` interval.

### 5. Forced power-off (unclean shutdown) — last-heartbeat fallback + flag
- [ ] With the agent running and an app foreground, **hold the power button** to hard-kill the machine (no clean shutdown). Boot back up; let the agent start.
- [ ] Day detail for that day, that device: **"Unclean shutdown"** badge on the device section. "Final PC off" = **time of the last heartbeat** before the kill (not "now", not midnight), with the `last heartbeat (unclean)` hint.
- [ ] `pc_session.unclean_shutdown = true`, `is_provisional = false`. The gap from last heartbeat to the next `agent_start` is **screen_off/reboot** (see §6), not counted as active.
- [ ] Card status reads **"Ended (unclean)"**.

### 6. Reboot vs agent-restart stitching (live)
- [ ] **Reboot:** Start → Restart (clean). After the agent comes back: day detail shows **one** PC session spanning the reboot, with a **Screen off → Reboot** interval for the down time. `os_boot_time` on post-reboot events is **> 5 min** different from before. `run_id` changed.
- [ ] **Agent restart, same boot:** Exit Agent from the tray, wait 1 min, relaunch (do **not** reboot). Day detail: **one** PC session; the 1-min gap is an **Untracked gap**, **not** a reboot. `os_boot_time` within a few seconds of before (fixed per run); `run_id` changed.
- [ ] Confirm in `monitoring_events` that every event of a single run carries the **same** `os_boot_time` (it is computed once at `agent_start`).

### 7. Legacy `/activities` regression check (poll now 15 s)
- [ ] Baseline: with `ACTIVITY_POLL_INTERVAL_SECONDS=5`, work normally for 20 min across 3–4 apps. Record `monitoring_activities` rows (count, durations, gaps).
- [ ] Repeat at the new default (15 s) for a comparable 20 min.
- [ ] Expected: **fewer, slightly longer** rows; total tracked time within a few % of baseline; no lost apps that were foreground ≥ 30 s; sum of active still ≈ wall time minus idle/screen-off.
- [ ] `GET /api/monitoring/activities` still returns rows; the pre-Phase-2 dashboard view (if still reachable) still renders.
- [ ] Set `ACTIVITY_POLL_INTERVAL_SECONDS=5` and confirm the old cadence is fully restored (escape hatch works).

### 8. Revoke endpoint + UI
- [ ] Dashboard → Monitoring → **Manage Devices** (owner/admin only; hidden for member role). Lists the enrolled agent(s) with last-heartbeat time.
- [ ] Click **Revoke** on a running agent, confirm. Toast success; row flips to **Revoked**.
- [ ] Within one heartbeat interval the desktop agent logs a 401, clears stored credentials, disables auto-start, and shows the setup screen. Tray → "setup required".
- [ ] `POST /api/monitoring/agents/:id/revoke` again → still 200 (idempotent). Heartbeat / events / activities from that agent → 401.
- [ ] As a **member**-role user, `GET /api/monitoring/agents` and the revoke POST → 403. The button is not shown.
- [ ] Data already collected for the revoked agent still appears in day detail / summary.

### 9. Sanity after the run
- [ ] No orphan `powershell.exe` after Exit Agent.
- [ ] `monitoring_recompute_queue` drains (no rows stuck in `error`).
- [ ] For every day touched: `active + idle + screen_off + untracked == total_seconds` (± a few s) on each device, and the merged user-day summary reconciles.
