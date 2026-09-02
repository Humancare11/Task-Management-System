# Monitoring fixes — change log

Five issues in the desktop **Task Monitoring Agent** and the **Monitoring dashboard** (Task Manager Frontend). Backend and DB were **not** changed.

## Files changed

| File | Issues | Notes |
|---|---|---|
| `Task-Monitoring-Agent/src/monitoring/activitySession.js` | #1, #2, #5 | session logic + emitted `activity_type` |
| `Task-Monitoring-Agent/src/monitoring/tracker.js` | #1, #2, #5 | idle source, logging |
| `Task-Monitoring-Agent/src/monitoring/screenState.js` | #2 | **new file** |
| `Task-Manager-Frontend/src/pages/monitoring/monitoringUtils.js` | #3, #4, #5 | `formatHm`, new `groupByApplication` |
| `Task-Manager-Frontend/src/pages/monitoring/MonitoringDrawer.jsx` | #3, #5 | renders the aggregated breakdown |

Not touched: backend controllers/models/migrations, `idleTime.js` (now dead code), `config.js`.

---

## Issue #1 — App sessions split on every window-title change

**Problem.** `sameWindow()` in `activitySession.js` treated any change in `window_title` as a new activity. With a 5 s poll and titles that churn constantly (tab names, `Inbox (12)` badges, `file.js — Project` editor captions, media timers), one continuous hour in an app became dozens of ~5 s rows.

**Change.**
- `sameWindow()` → renamed `sameActivity()`; the `windowTitle` comparison is removed. Session continuity now keys on `applicationName` + website `domain` only.
- When a poll matches the running session, the newest non-empty `windowTitle` is folded into it (so the stored row still reflects the current window) — it no longer *ends* the session.
- `tracker.js` — the logging-only `isNew` check was aligned (dropped `windowTitle`) so "Active application" log lines match real session boundaries.

**New behavior.** A continuous period in one application is **one** activity row with the real duration. Domain changes in a browser still split (see #5). App switches still split.

**Notes / limitations.**
- Two windows of the *same* non-browser app (two Word docs, two VS Code windows) now count as **one** session. Intended — the dashboard is per-application.
- Crash resilience is slightly reduced: a long single-app session is only written out when it ends or on clean shutdown (`stopActivityTracking`). A hard power-loss now loses more in-progress time than the old title-churn behavior did. Normal quit / Windows shutdown flush correctly.

---

## Issue #2 — Idle was triggered by keyboard/mouse inactivity

**Problem.** Idle = "no input for `IDLE_THRESHOLD_SECONDS` (60 s)". Long meetings, reading, and presentations were logged as idle.

**Change (final state).** Idle now means exactly one thing: **the physical display is OFF.** No inactivity timer, no screen-lock check, no screensaver check.
- New `screenState.js` — a per-poll PowerShell probe that reads the Windows `GUID_SESSION_DISPLAY_STATUS` power setting via `RegisterPowerSettingNotification` (Windows delivers the current state immediately on registration; the probe creates a hidden window, pumps the message loop briefly, reads `0=off / 1=on / 2=dimmed`, exits). Exposes `getScreenState() -> Promise<{ displayOff, determined }>`.
- `tracker.js` — `idleNow = screen.displayOff`; passes `{ isIdle: idleNow }` to the session tracker. `getIdleSeconds()` is no longer called.
- `activitySession.js` — `update()` now accepts an explicit `{ isIdle: boolean }`; the old `{ idleSeconds, thresholdSeconds }` rule is kept as a fallback (unused today, still unit-tested).

**New behavior.**

| Situation | Result |
|---|---|
| Display ON, long meeting / reading / presentation, zero input | Tracked as **one continuous active session** |
| Display powers OFF (power-plan timeout, monitor button, lock-then-off) | Current app session closes; **one** idle row extends for the whole dark period |
| Display powers ON again | Idle row closes; fresh app session starts from the current foreground window |
| Screen locked but monitor still on | Tracked as **active** until the display powers off |
| Screensaver running (monitor on) / display dimmed | Tracked as **active** |
| Machine sleeps (S3) | No polls run; gap not recorded; resumes on wake |
| Probe fails / non-Windows | **Fails open** → treated as display ON → keeps tracking |

**Notes / limitations.**
- Probe cost ~0.8–1.0 s per 5 s poll (PowerShell + WinForms load; C# compile is cached after the first call). Runs in `Promise.all` with `getActiveWindow`; the `if (running) return` guard prevents overlap. Same per-poll-PowerShell pattern as `activeWindow.js` / `domainDetector.js`.
- On/off transitions are detected at poll granularity → up to ~5 s per transition is attributed to the wrong side.
- Dead code left in place: `idleTime.js` is now unreferenced; `config.idleThresholdSeconds` / the `IDLE_THRESHOLD_SECONDS` env var are a silent no-op.
- Future upgrade for lower overhead + event-accurate transitions: replace the per-poll probe with one long-lived helper process that streams `RegisterPowerSettingNotification` events. Not done here (bigger change, lifecycle management).

---

## Issue #3 — Dashboard listed every raw activity row (`<1m` wall)

**Problem.** `MonitoringDrawer` mapped each `monitoring_activities` row to its own list item, so fragmented data showed as a long list of `<1m` entries.

**Change.**
- New pure helper `groupByApplication(activities)` in `monitoringUtils.js` — collapses an employee's rows into one entry per application with `duration_seconds` summed, sorted by time desc, with a single `Idle` entry last. Independent of `groupByEmployee` / `summarise`.
- `MonitoringDrawer.jsx` — the "Activity (N)" list is now an "Applications (N)" list built from a memoized `groupByApplication(shown.activities)`, with an empty state.

**New behavior.** The drawer shows `VS Code — 1h 20m`, `Chrome — 45m`, etc. instead of dozens of sub-minute rows. Per-app totals are exact (verified: sum of app-level entries == `groupByEmployee.activeSeconds`).

**Notes / limitations.**
- Section header count includes app + website + idle entries, so "Applications (6)" may mean 2 apps + 3 sites + 1 idle.
- Per-session clock ranges (`09:15 – 09:20`) and per-session `window_title` are no longer rendered in the drawer (data is still in the API response). The overall range stays in the Overview "Time" row.

---

## Issue #4 — `formatHm()` returned `<1m` for every sub-minute duration

**Change.** `monitoringUtils.js` `formatHm(seconds)`:
- `< 60 s` → `"45s"`
- `< 60 m` → `"12m"`
- `>= 1 h` → `"1h 15m"` (no zero-padding)
- `0 / NaN / null / negative` → `"0s"`; string input coerced.

**New behavior.** Real precision everywhere durations are shown (`MonitoringCard`, `MonitoringDrawer`, `MonitoringSummary`).

**Notes.** Visible format change: `01h 15m` → `1h 15m`, `00h 05m` → `5m`, `0m` → `0s`. Function name is now a slight misnomer (it also returns seconds).

---

## Issue #5 — Website/domain activity type mismatch

**Problem.** The agent only ever emitted `activity_type: "application"` or `"idle"`; browser rows were stored as `application` + a `domain`. The dashboard and backend already supported `"website"` (ENUM, `ALLOWED_ACTIVITY_TYPES`, `TYPE_META`, the "Website" type filter, the `websites` counter) — but nothing produced it, so the filter always returned nothing and the counter was always 0.

**Change.**
- `activitySession.js` `buildActivity()` — a non-idle session with a `domain` is now emitted as `activity_type: "website"` (still carrying `application_name` + `domain` + `window_title`). Browser with no detectable domain (`chrome://`, new tab) stays `"application"`. Non-browser apps unchanged. Internal session type is still `"application"` — only the emitted row type changes.
- `tracker.js` — logging `=== "application"` → `!== "idle"` so website rows still log app + domain.
- `monitoringUtils.js` `groupByApplication()` — under each browser application, emits a per-domain `website` child entry (`gmail.com — 18m`, …). **Detected by `a.domain` presence**, so it works for new `"website"` rows *and* legacy `"application" + domain` rows.
- `MonitoringDrawer.jsx` — website child entries render indented (`ml-4`) with the Globe icon + "Website" badge.

**New behavior.**
```
Google Chrome   45m   [Application]
  gmail.com     18m   [Website]
  youtube.com   12m   [Website]
  github.com     5m   [Website]
```
The "Website" type filter now returns data; `groupByEmployee.websites` is populated; `groupByEmployee.activeSeconds` still includes website time.

**Notes / limitations.**
- No data migration. Rows already in the DB stay `activity_type: "application"`. Consequence: on `MonitoringCard`, the Globe (websites) counter reads 0 for historical browsing. The drawer still shows those correctly (domain-driven). New data is fully correct.
- The **"Application" type filter now excludes browser-with-domain rows** (they're `"website"`). Intended.
- DB ENUM already includes `"website"` (initial `20260827000000-create-monitoring-activities` migration) — no schema change needed.

---

## Verification

Verified with standalone Node harnesses driving `ActivitySessionTracker` / `groupByApplication` / `formatHm` / `groupByEmployee`, the live `getScreenState()` on Windows, and `vite build`. Covered: continuous-session behavior, display on/off transitions, idle-row extension, app/domain splitting, aggregation totals vs `groupByEmployee`, `formatHm` cases, website filter shape, backward-compat with legacy data, and cross-issue interactions. Test scripts were ad-hoc (not committed); re-verify with `npx vite build` in the frontend and a manual agent run.

## Quick re-test checklist for the agent

1. Run the agent, keep one app foreground for several minutes without touching the keyboard/mouse → expect **one** activity row, not many.
2. Let the display power off (or force it) → expect an `idle` row; turn it back on → expect tracking to resume.
3. Browse two sites in one browser → expect two `website` rows with the correct domains.
4. Dashboard: open an employee drawer → expect the aggregated "Applications" list with website children and real durations (`45m`, `1h 20m`, `35s`).
