"use strict";

/**
 * Screen-visibility consent document — the SINGLE SOURCE OF TRUTH for the
 * notice shown to employees, covering BOTH ways an authorized person may see
 * an employee's screen: continuous Live View, and a one-time Screenshot.
 * (The exported names keep the historical LIVE_SCREEN_* prefix — renaming
 * them would touch many files for no functional benefit — but the document
 * itself now covers both features under one "may see my screen" consent,
 * since that is one permission from the employee's point of view.)
 *
 * ── When it is shown ────────────────────────────────────────────────────────
 * ONCE, during Monitoring Agent setup (and, for an agent installed before
 * either feature existed, once on its first launch afterwards). There is NO
 * per-session / per-screenshot prompt: once the employee accepts, every
 * future Live View session and every future Screenshot reuse that recorded
 * consent (a monitoring_consents row for this version). The agent never pops
 * this notice again unless the version below changes.
 *
 * Changing the wording in any material way -> BUMP the version (sortable
 * string). Every employee is then re-prompted once, at setup / next launch.
 *
 * NOTE: recording consent does not enable anything on its own. Both features
 * also require the per-org live_screen_enabled setting and a viewer who is
 * the org owner or holds an active monitoring_content_grant. Both are
 * audited (monitoring_live_screen_sessions / monitoring_screenshot_requests).
 *
 * ── v3 (2026-09-05) ─────────────────────────────────────────────────────────
 * Added the viewer's client-side "Screenshot" capability DURING a Live View
 * session (a still frame the viewer may save to their own computer — see
 * LiveScreenViewer.jsx). v2 told employees no screenshots are ever saved
 * anywhere, which this made untrue, so the notice was corrected.
 *
 * ── v4 (2026-09-05) ─────────────────────────────────────────────────────────
 * Added standalone, one-time Screenshot capture as its OWN feature — it can
 * happen WITHOUT a Live View session ever starting, and works even when Live
 * View's peer-to-peer connection cannot connect (it uses no video/WebRTC at
 * all; the agent captures one still frame directly). Because there is no
 * ongoing session in that case, there is no persistent banner or Stop button
 * for it — instead the employee sees a brief on-screen notice at the moment
 * of capture. This is a materially different mechanism from v3's "screenshot
 * during a live session," so the notice is rewritten to describe both
 * distinctly and the version is bumped.
 */

const LIVE_SCREEN_CONSENT_DOCUMENT_VERSION = "2026-09-05.ls-v4";

const LIVE_SCREEN_CONSENT_DOCUMENT_TITLE =
  "Notice & Consent — Someone Seeing Your Screen (Live View & Screenshots)";

const LIVE_SCREEN_CONSENT_DOCUMENT_TEXT = `This is part of setting up the Monitoring Agent on this computer. You are being
asked ONCE for your consent; after you accept, you will not be asked again.

WHAT YOU ARE CONSENTING TO
In addition to the activity monitoring already described, an authorized person
— the organization owner, or someone they have specifically and temporarily
authorized — may see your screen in TWO separate ways:

  1. LIVE VIEW — they watch your screen live, in real time, from the
     management dashboard, for as long as that session runs.
  2. SCREENSHOT — they request a single still picture of whatever is on your
     screen at that moment. This does NOT require a Live View session to be
     running, and it works even when a live connection cannot be made — it
     never uses video or a live stream, just one instant image.

Both are started only by that authorized person; you cannot be watched
continuously "in the background" without one of these two things happening.

YOU ARE ALWAYS TOLD WHEN IT IS HAPPENING
  • LIVE VIEW: whenever a session is active you will see an on-screen banner —
    "Your screen is being viewed live by <name>" — for the entire time. If
    that banner is not on your screen, no one is viewing it live. The banner
    has a "Stop" button; you can end any live session yourself, at any time,
    for any reason, with one click.
  • SCREENSHOT: because it is instantaneous, there is nothing to "stop" — but
    you will see a brief on-screen notice at the moment it happens, naming who
    requested it.

WHAT IS AND IS NOT KEPT
  • A Live View is NOT recorded. There is no continuous recording of the
    session — not on your computer, not on the server, not anywhere.
  • While a Live View session is active, the viewer can ALSO save a still image
    of that session to their own computer (the same kind of image as a
    standalone Screenshot, just taken from the live picture instead of
    requested on its own).
  • A Screenshot — whether taken during a Live View session or on its own —
    is a single image. It is a deliberate action the viewer takes (never
    automatic), and it is never saved on the company's server — it can only
    end up on the viewer's own device, and only if they choose to keep it.
  • The only things stored on the server are log entries: who viewed or
    requested what, when, and (for Live View) for how long. Never the
    picture itself.

YOUR CHOICE
  • "I Accept" allows authorized, indicated Live View and Screenshot access to
    your screen for your account, as described above.
  • "I Decline", or closing this window, means neither Live View nor
    Screenshot can be used on your account. Your other monitoring is
    unaffected, and declining has no other effect on setup.
  • You can withdraw this consent at any time by contacting your manager or HR.

By choosing "I Accept" you confirm that you have read this notice and consent
to authorized, indicated Live View and Screenshot access to your screen as
described above.`;

module.exports = {
  LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
  LIVE_SCREEN_CONSENT_DOCUMENT_TITLE,
  LIVE_SCREEN_CONSENT_DOCUMENT_TEXT,
};
