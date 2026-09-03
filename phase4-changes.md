# Phase 4 — in-app content capture (search terms / AI prompts)

**Ships fully inert.** `CONTENT_CAPTURE_LEGALLY_APPROVED = false` in
[`config/contentCaptureGate.js`](Task-Manager-Backend/config/contentCaptureGate.js)
and is a compile-time constant with **no env override**. While it is false:

- the agent capture module never activates (the heartbeat always returns `content_capture.active: false`),
- `POST /api/monitoring/agent/content` returns **501** before any DB work,
- `GET /api/monitoring/content` returns **403**,
- the dashboard content panel renders **nothing**.

Nothing is captured, transmitted, or stored until you flip that one constant —
and even then, only for orgs that opt in and employees who have a consent row.

Legacy `/activities` still dual-emits. No DB schema changes — every table was
built in Phase 0.

---

## The five safeguards — each a hard runtime gate (fail CLOSED)

All five live in [`services/monitoringContent.js`](Task-Manager-Backend/services/monitoringContent.js)
as pure functions (`evaluateIngest`, `canViewContent`, `selectExpiredWhere`, …)
with thin DB wrappers, so each is unit-tested directly.

### 1. Consent — required before any capture
- **New** `POST /api/monitoring/agent/consent` (agent-auth) → `findOrCreate` on `monitoring_consents (user_id, document_version)`, storing `accepted_at`, `method`, `ip`. **Not** gated by the legal flag — consent rows must be able to exist before you flip it. Idempotent.
- The agent shows a consent screen (new consent view in `src/ui/index.html` + `content:*` IPC) when the heartbeat reports `org_enabled && consent_required && !consented`. Acceptance is POSTed to the server **first**, then cached locally in `agent-content-consent.json` (convenience only — the server row is authoritative).
- **`evaluateIngest` rejects the whole batch with 403 `no_consent`** when no `monitoring_consents` row matches `(agent.user_id, CONTENT_CONSENT_DOCUMENT_VERSION)`.
- The heartbeat's `content_capture.active` is `true` **only** when legal gate open **AND** org enabled **AND** a consent row exists.

### 2. Blocklist — never capture from these
- [`utils/contentBlocklist.js`](Task-Manager-Backend/utils/contentBlocklist.js): `HARDCODED_BLOCKLIST` (banking / payment / health / government) is the always-on fallback; `loadActivePatterns()` merges the operator-tunable `monitoring_blocklist_domains` table on top (5-min cache; DB failure → fallback still applies). Pattern semantics match the migration (`example.com`, `*.example.com`, `*.gov`).
- Enforced **on both sides**: the agent ([`contentBlocklistClient.js`](Task-Monitoring-Agent/src/monitoring/contentBlocklistClient.js), byte-synced hardcoded list) refuses to capture; the server re-checks every item and **drops** blocklisted ones (`reason: "blocklisted_domain"`). An unknown/empty domain is **also** dropped (fail closed).
- **Password / masked fields**: the agent's UIA reader ([`uiaReader.js`](Task-Monitoring-Agent/src/monitoring/uiaReader.js)) checks `Current.IsPassword` and never returns text for a password control; the server drops any item flagged `is_password`.

### 3. Extra encryption, separate store
- [`utils/contentCrypto.js`](Task-Manager-Backend/utils/contentCrypto.js) (AES-256-GCM, per-row IV, versioned keys) encrypts every survivor **before** `bulkCreate` into `monitoring_content_events`. There is no plaintext column.
- Plaintext lives only transiently: in agent RAM → the agent's **in-memory** content queue ([`contentPipeline.js`](Task-Monitoring-Agent/src/monitoring/contentPipeline.js) — deliberately *not* the crash-safe on-disk queue, so no plaintext at rest on the employee's machine) → the POST body → dropped on 2xx.
- `evaluateIngest` returns **503** if `contentCrypto.isConfigured()` is false — plaintext is never accepted without a key to encrypt it.

### 4. Short retention
- `expires_at = captured_at + clamp(org.content_retention_days, 30, 90)` (`retentionDays()`), fixed at insert time.
- **New** [`services/monitoringContentRetention.js`](Task-Manager-Backend/services/monitoringContentRetention.js) — daily job (wired into `index.js`), hard-`DELETE`s rows where `expires_at < now()` and **nothing else** (`selectExpiredWhere` is `{ expires_at: { [Op.lt]: now } }`, asserted in tests).

### 5. Restricted access + audit
- **New** `GET /api/monitoring/content?user_id&from&to` (JWT). `canViewContent`: **org owner** always; anyone else needs an **active** `monitoring_content_grants` row (not revoked, not expired, target matches or org-wide). No `requireRole` on the route — a granted non-admin reviewer is valid.
- A `monitoring_content_access_logs` row is written **before** any content row is read (viewer, target, range, ip; `row_count` patched after). Test asserts `accesslog.create` precedes `content.findAll`, and that a **denied** request reads/logs nothing.
- Content is **decrypted on the fly**; an undecryptable row (key gone / tampered) is surfaced as `{ text: null, undecryptable: true }`, never a crash.
- Dashboard `ContentPanel` (in `MonitoringDayDetail.jsx`) renders **only** on a 200 — a 403/501 keeps it invisible.

---

## Agent capture module

[`contentCapture.js`](Task-Monitoring-Agent/src/monitoring/contentCapture.js) +
[`contentCaptureRunner.js`](Task-Monitoring-Agent/src/monitoring/contentCaptureRunner.js):

- **Allowlist only**: `google.com`, `youtube.com`, `chatgpt.com` / `chat.openai.com`, `claude.ai`, `gemini.google.com`. Everything else → nothing.
- Reads the **focused edit control** via Windows UI Automation (`uiaReader.js`) — nothing else, no keystrokes, no page content. Password controls return no text.
- **Debounced** (`reduceQuery`): emits the last non-empty value when the field clears, the domain changes, or the browser loses focus — approximating "on submit / navigation" without a keyboard hook.
- **Best-effort**: tolerates "nothing found", never throws; a rate-limited warning fires after repeated UIA misses so a broken selector (target site changed its markup) is noticeable in the log.
- **Incognito / InPrivate / private windows** → captures nothing (`looksPrivate` window-title heuristic).
- Emits `content_capture {app, kind, text, domain}` onto the separate in-memory content queue. Never runs unless the heartbeat says `active: true` (Electron only — `powerMonitor`-style, no headless path; consent needs the UI anyway).

---

## Test status

```
Backend  (node --test)   77 / 77   pass   (+22:  monitoringContent, contentBlocklist)
Agent    (node --test)   39 / 39   pass   (+14:  contentCapture, contentPipeline)
Frontend (vite build)    clean
```

The five scenarios you asked for, by name:

| Scenario | Test |
|---|---|
| blocklisted domain → nothing stored | `monitoringContent.test.js` › "BLOCKLISTED DOMAIN → that item is dropped" / "ALL items blocklisted → 200 and zero rows" |
| no consent → ingest rejected | `monitoringContent.test.js` › "NO CONSENT → ingest rejected (403), nothing stored" |
| access endpoint → audit row written first | `monitoringContent.test.js` › "ACCESS ENDPOINT writes the audit row BEFORE returning content" (+ "access denied → 403 and NO content query at all") |
| retention deletes only expired | `monitoringContent.test.js` › "selectExpiredWhere targets only rows past expires_at" / "sweepExpiredContent deletes with the expired-only WHERE" |
| wrong key_version → decrypt fails | `contentCrypto.test.js` › "decrypt throws clearly when the key version is gone" + `monitoringContent.test.js` › "readContent decrypts on the fly and flags undecryptable rows" |

Also live-verified against the DB + over HTTP: heartbeat returns the `content_capture` block; consent endpoint records + is idempotent; `/agent/content` returns 501; and with the gate forced open in a harness, a 3-item batch stored 1 (blocklisted + password dropped), read back decrypted, wrote an access-log row, and retention deleted it only after `expires_at`.

---

## What YOU need to finalize before flipping `CONTENT_CAPTURE_LEGALLY_APPROVED`

1. **Consent document text.** Replace the placeholder in `src/ui/index.html` (`#consent-view`) with the legally-reviewed wording. Then set `CONTENT_CONSENT_DOCUMENT_VERSION` in `contentCaptureGate.js` to a real version string (e.g. `2026-10-v1`). Changing that string invalidates all prior consents until re-accepted — intended.
2. **Legal review** of the feature + the consent flow (your gate condition #3).
3. **Encryption keys in the backend env**: `MONITORING_CONTENT_KEYS` (JSON `{ "v1": "<base64 32 bytes>" }`) and `MONITORING_CONTENT_KEY_ACTIVE=v1`. Until these exist, ingest returns 503 even with the flag on. Decide where these live (secrets manager) and the rotation runbook.
4. **Per-org enablement**: for each participating org, create/patch a `monitoring_org_settings` row with `content_capture_enabled = true` and the desired `content_retention_days` (30–90). There is no admin UI for this yet — decide whether you want one or will do it by hand.
5. **Consent capture path for real**: the agent screen covers the desktop flow. If HR/portal-based signed acknowledgment is the required method (per the gate header), that flow needs building and should write `monitoring_consents` with `method` set accordingly.
6. **Grants UI** (optional): `monitoring_content_grants` is enforced but has no create/revoke UI — owners can currently only view their own org's content. Decide if reviewer grants are needed at launch.
7. **Blocklist review**: confirm `monitoring_blocklist_domains` (seeded) + the hardcoded fallback cover your jurisdictions. Add region-specific banking/health/gov domains.
8. **UIA selector validation**: the capture module reads the *focused* field generically, which is resilient, but do a real pass on each allowlisted site (Google, YouTube, ChatGPT, Claude, Gemini) to confirm the focused-element read returns the query text and nothing adjacent. Watch the rate-limited "UIA misses" warning after any target site redesign.
9. **Retention on existing data**: none exists yet (gate closed), so nothing to migrate — but confirm the daily job is running in your deploy (`MONITORING_CONTENT_RETENTION_ENABLED` not set to `false`).
