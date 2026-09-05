"use strict";

/**
 * Live Screen consent document — the SINGLE SOURCE OF TRUTH for the notice
 * shown to employees.
 *
 * ── When it is shown ────────────────────────────────────────────────────────
 * ONCE, during Monitoring Agent setup (and, for an agent installed before this
 * feature existed, once on its first launch afterwards). There is NO per-session
 * prompt: once the employee accepts, every future Live Screen session reuses
 * that recorded consent (a monitoring_consents row for this version). The agent
 * never pops this notice again unless the version below changes.
 *
 * Changing the wording in any material way -> BUMP the version (sortable
 * string). Every employee is then re-prompted once, at setup / next launch.
 *
 * NOTE: recording consent does not enable anything on its own. Live Screen also
 * requires the per-org live_screen_enabled setting and a viewer who is the org
 * owner or holds an active monitoring_content_grant. Every session is audited
 * (monitoring_live_screen_sessions) and shows the employee an on-screen banner
 * with a Stop button for its whole duration.
 *
 * ── v3 (2026-09-05) ─────────────────────────────────────────────────────────
 * Added the viewer's client-side "Screenshot" capability (a still frame of the
 * live view the viewer may save to their own computer during a session — see
 * LiveScreenViewer.jsx; nothing is ever sent to or stored on the server). v2
 * told employees no screenshots are ever saved anywhere, which this makes
 * untrue, so the notice is corrected and the version bumped: every employee is
 * re-prompted once before the feature is truthfully covered for them.
 */

const LIVE_SCREEN_CONSENT_DOCUMENT_VERSION = "2026-09-05.ls-v3";

const LIVE_SCREEN_CONSENT_DOCUMENT_TITLE =
  "Notice & Consent — Live View of Your Screen";

const LIVE_SCREEN_CONSENT_DOCUMENT_TEXT = `This is part of setting up the Monitoring Agent on this computer. You are being
asked ONCE for your consent; after you accept, you will not be asked again.

WHAT YOU ARE CONSENTING TO
  • In addition to the activity monitoring already described, an authorized
    person — the organization owner, or someone they have specifically and
    temporarily authorized — may VIEW YOUR SCREEN LIVE, in real time, from the
    management dashboard.
  • Sessions are started and stopped by that authorized person.

YOU ARE ALWAYS TOLD WHEN IT IS HAPPENING
  • Whenever a session is active you will see an on-screen banner — "Your screen
    is being viewed live by <name>" — for the entire time. If that banner is not
    on your screen, no one is viewing it.
  • The banner has a "Stop" button. You can end any session yourself, at any
    time, for any reason, with one click.

WHAT IS AND IS NOT KEPT
  • The live view itself is NOT recorded. There is no continuous recording of
    the session — not on your computer, not on the server, not anywhere.
  • While a session is active, the authorized viewer CAN capture a single still
    image ("screenshot") of what is on your screen at that moment and save that
    one image to their own computer. This is the only way any picture from a
    session can be kept, it is a deliberate action the viewer takes (not
    automatic), and it is never sent to or stored on the company's server — it
    can only end up on the viewer's own device, and only if they save it.
  • The connection is peer-to-peer; the live picture itself goes straight to
    the viewer's browser and is gone the moment the session ends, aside from
    any still image the viewer explicitly saved as described above.
  • The only thing stored on the server is a log entry: who viewed, when, and
    for how long.

YOUR CHOICE
  • "I Accept" allows authorized, on-screen-indicated live viewing of your
    screen for your account, including the viewer's ability to save a still
    image as described above.
  • "I Decline", or closing this window, means your screen cannot be viewed
    live. Your other monitoring is unaffected, and declining has no other effect
    on setup.
  • You can withdraw this consent at any time by contacting your manager or HR.

By choosing "I Accept" you confirm that you have read this notice and consent to
authorized, banner-indicated live viewing of your screen — including the
viewer's ability to save a still image of the screen during a session, as
described above.`;

module.exports = {
  LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
  LIVE_SCREEN_CONSENT_DOCUMENT_TITLE,
  LIVE_SCREEN_CONSENT_DOCUMENT_TEXT,
};
