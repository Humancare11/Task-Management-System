# §5b consent flow — wired up

The desktop agent now shows every monitored user a written notice covering
**search-term and AI-prompt recording**, with **I Accept / I Decline**. Accept
records a `monitoring_consents` row; Decline or closing the window records
nothing and no capture occurs. Capture still does **not** run — the legal gate
`CONTENT_CAPTURE_LEGALLY_APPROVED` is unchanged (`false`).

---

## What changed

### Backend

| File | Change |
|---|---|
| **`config/contentConsentDocument.js`** *(new)* | Single source of truth: `CONTENT_CONSENT_DOCUMENT_VERSION = "2026-09-04.v1"`, `CONTENT_CONSENT_DOCUMENT_TITLE`, and the full `CONTENT_CONSENT_DOCUMENT_TEXT`. To change the wording, edit here and **bump the version string** — every user is then re-prompted for the new version. |
| `config/contentCaptureGate.js` | `CONTENT_CONSENT_DOCUMENT_VERSION` now comes from the new file (re-exported, so existing imports are unchanged). `CONTENT_CAPTURE_LEGALLY_APPROVED` still `false`. |
| `controllers/monitoringController.js` — `agentHeartbeat` | The `content_capture` block now sets `consent_required: true` whenever the **org** has enabled capture — *independent of the legal gate* — and includes the notice `document_title` + `document_text` **only while consent is still needed** (keeps routine heartbeats small). `active` (the only thing that starts capture) still requires **all three**: legal gate open **AND** org enabled **AND** a consent row. |
| `controllers/monitoringController.js` — **`getMonitoringConsentStatus`** *(new)* | `GET /api/monitoring/consents` (owner/admin, read-only). |
| `routes/monitoringRoute.js` | Mounts `GET /consents`. |

`submitAgentConsent` (`POST /api/monitoring/agent/consent`), the ingest gate
(`evaluateIngest` still checks `hasConsent`), blocklist, encryption, retention,
and the audited read path are all **unchanged**.

### Agent

| File | Change |
|---|---|
| **`src/monitoring/contentConsentDecision.js`** *(new)* | Pure `decideContentAction(signal, ctx)` → `{ capture, prompt, cacheConsent }`. Fully unit-tested. |
| `src/main.js` | `applyContentSignal` now drives off that pure function. Prompts for consent as soon as the org enables capture (not only after the flag flips). Capture starts **only** on `signal.active === true`. Consent signal is applied only on a *successful* heartbeat (no flap on a network blip). `content:getConsentState` IPC returns the pending notice text so the screen can be reopened. |
| `src/ui/index.html` | Consent view renders the server's notice **verbatim** in a scrollable box; buttons are **I Accept** / **I Decline**; the screen reappears on next open if a decision is still pending. Accept → `POST /agent/consent` (server records first) → local cache. |

Agent activity/events pipeline, the display-power watcher, powerMonitor wiring,
`pipelineMode`, and the recompute path are untouched.

---

## Roll it out (per organization)

1. **Deploy** the backend + push the updated agent build to the installed agents.
2. **Enable the org setting** — one row per participating organization:
   ```sql
   INSERT INTO monitoring_org_settings (organization_id, content_capture_enabled, content_retention_days, created_at, updated_at)
   VALUES (<org_id>, 1, 30, NOW(), NOW())
   ON DUPLICATE KEY UPDATE content_capture_enabled = 1;
   ```
   (This does **not** start capture — the legal gate is still closed. It only
   makes the agents show the consent notice.)
3. On each already-installed agent, the next heartbeat (~30 s) pops the agent
   window with the notice. The user reads it and clicks **I Accept** or
   **I Decline**. Accept writes a `monitoring_consents` row
   `(user_id, document_version = "2026-09-04.v1", method = "agent", ip)`.
4. A user who declines or closes the window is re-prompted on the agent's next
   launch. Nothing is captured from them.

---

## Verify — "consent rows exist for every monitored user"

As an owner/admin:

```
GET /api/monitoring/consents
Authorization: Bearer <JWT>
```

```jsonc
{
  "document_version": "2026-09-04.v1",
  "monitored_user_count": 6,
  "consented_count": 6,
  "all_monitored_users_consented": true,        // <- this is the go/no-go
  "users": [
    { "user_id": 12, "name": "…", "email": "…",
      "consented": true, "accepted_at": "2026-09-05T09:14:22.000Z", "method": "agent" },
    …
  ],
  "remaining_to_enable_capture": {
    "all_monitored_users_consented": true,
    "encryption_keys_configured": false,
    "org_setting_content_capture_enabled": true,
    "legal_gate_CONTENT_CAPTURE_LEGALLY_APPROVED": false
  }
}
```

"Monitored user" = any user with an `status = 'active'` monitoring agent in your
org. `users` is sorted with the not-yet-consented first.

---

## What still remains to enable capture

From `remaining_to_enable_capture` above — three independent things, none done by
this change:

| # | Item | How | Status now |
|---|---|---|---|
| 1 | **Every monitored user consented** | The rollout above; watch `all_monitored_users_consented` | pending (collect consents) |
| 2 | **Encryption key registry configured** | Set backend env `MONITORING_CONTENT_KEYS` = `{"v1":"<base64 32-byte key>"}` and `MONITORING_CONTENT_KEY_ACTIVE=v1`. Until set, ingest returns 503. | **not configured** |
| 3 | **Org setting `content_capture_enabled`** | Step 2 of the rollout. | set once you run it |
| 4 | **The legal flag** | Edit `config/contentCaptureGate.js`: `CONTENT_CAPTURE_LEGALLY_APPROVED = true` — a reviewed code change, then redeploy. Do this **last**, only after 1–3 and your legal sign-off. | **false** (as instructed) |

When all four are true, the next agent heartbeat returns `content_capture.active:
true`, the agent starts the capture module, and captured search terms / prompts
flow to `POST /api/monitoring/agent/content` → encrypted → `monitoring_content_events`,
visible in the day-detail content panel (owner, or a granted reviewer, with every
view audited).

---

## Tests

```
Backend  (node --test)   81 / 81  pass   (+4  contentConsentDocument)
Agent    (node --test)   56 / 56  pass   (+10 contentConsentDecision)
Frontend (vite build)    clean
```

Live-verified against the local DB: org disabled → agent not prompted; org
enabled → heartbeat carries the notice text, `active:false`; `POST /agent/consent`
→ 201; next heartbeat → `consented:true`, `active:false` (capture still off);
`GET /consents` → per-user status + the remaining checklist.
