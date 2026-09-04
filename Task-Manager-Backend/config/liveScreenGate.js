"use strict";

/**
 * HARD LEGAL GATE for the Live Screen feature (real-time view of an employee's
 * screen).
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  DO NOT set LIVE_SCREEN_LEGALLY_APPROVED to true until:
 *    1. The live-screen consent document (LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
 *       config/liveScreenConsentDocument.js) is finalized and legally reviewed.
 *       This is a SEPARATE consent from §5b content capture — the §5b notice
 *       explicitly tells employees their screen contents are NOT recorded.
 *    2. Consent rows exist for the employees who may be viewed.
 *    3. This feature has passed an actual legal review, including the mandatory
 *       on-screen "your screen is being viewed" indicator and the no-recording
 *       guarantee.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * While this is false, the entire live-screen path is disabled end to end:
 *   - the agent never captures the screen,
 *   - the signaling endpoints return 501,
 *   - the socket events reject with "not enabled",
 *   - the dashboard tile stays a placeholder.
 * regardless of any per-org setting, consent row, grant, or role.
 *
 * Compile-time constant on purpose — there is deliberately NO env var override.
 * Flipping it is a reviewed code change.
 *
 * Live Screen NEVER records or stores anything: the media is peer-to-peer
 * WebRTC (agent -> viewer), the backend relays only SDP/ICE text which is held
 * in memory and discarded on teardown, and nothing is written to the database,
 * disk, or object storage. Only session METADATA (who viewed whom, when, for
 * how long, why it ended) is persisted, in monitoring_live_screen_sessions.
 */

const LIVE_SCREEN_LEGALLY_APPROVED = false;

const {
  LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
} = require("./liveScreenConsentDocument");

/**
 * Whether live screen may run for an organization. ALL of:
 *   - the hard legal gate is open,
 *   - the org has explicitly enabled live screen.
 * Per-employee consent and per-viewer authorization are checked separately.
 *
 * @param {{ live_screen_enabled?: boolean }|null} orgSettings
 * @returns {boolean}
 */
function liveScreenAllowed(orgSettings) {
  if (!LIVE_SCREEN_LEGALLY_APPROVED) return false;
  if (!orgSettings || !orgSettings.live_screen_enabled) return false;
  return true;
}

module.exports = {
  LIVE_SCREEN_LEGALLY_APPROVED,
  LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
  liveScreenAllowed,
};
