"use strict";

/**
 * Live Screen consent document — the SINGLE SOURCE OF TRUTH for the notice
 * shown to employees before their screen can be viewed live.
 *
 * SEPARATE from the §5b content-capture consent: that notice tells employees
 * their screen contents are NOT recorded, so live viewing needs its own,
 * explicit acknowledgment.
 *
 * The agent fetches this text via the heartbeat and shows it on the consent
 * screen; on "I Accept" the agent posts LIVE_SCREEN_CONSENT_DOCUMENT_VERSION
 * back and the server writes a monitoring_consents row against it. A live-screen
 * session may only start when a matching consent row exists for the employee.
 *
 * Changing the wording in any material way -> BUMP the version (sortable
 * string). Every employee is then re-prompted before the next session.
 *
 * NOTE: recording consent here does not enable anything. Live screen also
 * requires LIVE_SCREEN_LEGALLY_APPROVED (config/liveScreenGate.js) and the
 * per-org live_screen_enabled setting.
 */

const LIVE_SCREEN_CONSENT_DOCUMENT_VERSION = "2026-09-04.ls-v1";

const LIVE_SCREEN_CONSENT_DOCUMENT_TITLE =
  "Notice & Consent — Live View of Your Screen";

const LIVE_SCREEN_CONSENT_DOCUMENT_TEXT = `Your employer is asking for your consent to VIEW YOUR SCREEN LIVE, in real
time, from the management dashboard.

WHAT THIS MEANS
  • When an authorized person (the organization owner, or someone they have
    specifically and temporarily authorized) starts a Live Screen session, they
    see whatever is currently on your screen, as it happens.
  • You will ALWAYS see an on-screen banner — "Your screen is being viewed by
    <name>" — for the entire time a session is active. If that banner is not
    shown, no one is viewing your screen.
  • The banner has a "Stop" button. You can end the session yourself at any
    time, for any reason, with one click.

WHAT IS AND IS NOT KEPT
  • The live view is NOT recorded. No video and no screenshots are saved — not
    on your computer, not on the server, not anywhere.
  • The connection is peer-to-peer; the picture goes straight to the viewer's
    browser and is gone the moment the session ends.
  • The only thing stored is a log entry: who viewed, when, and for how long.

YOUR CHOICE
  • "I Accept" allows authorized live-screen sessions for your account.
  • "I Decline", or closing this window, means your screen cannot be viewed
    live. Your other monitoring is unaffected, and declining has no other
    effect here.
  • You can withdraw this consent at any time by contacting your manager or HR.

By choosing "I Accept" you confirm that you have read this notice and consent
to authorized, indicated, non-recorded live viewing of your screen as
described above.`;

module.exports = {
  LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
  LIVE_SCREEN_CONSENT_DOCUMENT_TITLE,
  LIVE_SCREEN_CONSENT_DOCUMENT_TEXT,
};
