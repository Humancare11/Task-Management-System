"use strict";

/**
 * LEGAL GATE for the Live Screen feature (real-time view of an employee's
 * screen). Compile-time constant on purpose — there is deliberately NO env var
 * override. Flipping it is a reviewed code change.
 *
 * Opened 2026-09-04: legal approval confirmed for this design specifically —
 * real-time WebRTC screen viewing with the mandatory on-screen "your screen is
 * being viewed" banner + employee Stop button retained, a one-time consent
 * taken at agent setup (LIVE_SCREEN_CONSENT_DOCUMENT_VERSION,
 * config/liveScreenConsentDocument.js), admin-only start/stop, no recording,
 * and per-session audit logging.
 *
 * Live Screen NEVER records or stores anything: the media is peer-to-peer
 * WebRTC (agent -> viewer), the backend relays only SDP/ICE text which is held
 * in memory and discarded on teardown, and nothing is written to the database,
 * disk, or object storage. Only session METADATA (who viewed whom, when, for
 * how long, why it ended) is persisted, in monitoring_live_screen_sessions.
 *
 * Runtime still requires: the per-org live_screen_enabled setting, a recorded
 * consent row for the employee, and a viewer who is the org owner or holds an
 * active monitoring_content_grant.
 */

const LIVE_SCREEN_LEGALLY_APPROVED = true;

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
