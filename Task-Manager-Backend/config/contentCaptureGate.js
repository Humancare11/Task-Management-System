"use strict";

/**
 * HARD LEGAL GATE for §5b in-app content capture (search terms / AI prompts).
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  DO NOT set CONTENT_CAPTURE_LEGALLY_APPROVED to true until:
 *    1. The consent document text (CONTENT_CONSENT_DOCUMENT_VERSION below) is
 *       finalized and legally reviewed.
 *    2. An acknowledgment flow is in use and consent rows exist for the
 *       employees who will be captured.
 *    3. That flow and this feature have passed an actual legal review.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * While this is false, the entire content-capture path is disabled end to end:
 *   - the agent capture module never runs,
 *   - POST /api/monitoring/agent/content returns 501,
 *   - GET /api/monitoring/content returns 403,
 *   - the dashboard content panel stays hidden,
 * regardless of any per-org setting, consent row, or feature flag.
 *
 * This is a compile-time constant on purpose — there is deliberately NO env var
 * override. Flipping it is a reviewed code change.
 */

const CONTENT_CAPTURE_LEGALLY_APPROVED = false;

// The consent document version employees must have accepted before any of their
// content is captured or stored. Defined with the notice text in
// config/contentConsentDocument.js (single source of truth); re-exported here so
// existing importers keep working. A capture / ingest is only valid against a
// monitoring_consents row matching (user_id, this exact string).
const {
  CONTENT_CONSENT_DOCUMENT_VERSION,
} = require("./contentConsentDocument");

const { isConfigured } = require("../utils/contentCrypto");

/**
 * The full runtime check for whether captured content may be collected/stored
 * for a given organization. ALL of the following must hold:
 *   - the hard legal gate is open,
 *   - encryption keys are configured,
 *   - the organization has explicitly enabled capture.
 *
 * Per-employee consent is checked separately (hasConsent), per request.
 *
 * @param {{ content_capture_enabled?: boolean }|null} orgSettings
 * @returns {boolean}
 */
function contentCaptureAllowed(orgSettings) {
  if (!CONTENT_CAPTURE_LEGALLY_APPROVED) return false;
  if (!isConfigured()) return false;
  if (!orgSettings || !orgSettings.content_capture_enabled) return false;
  return true;
}

module.exports = {
  CONTENT_CAPTURE_LEGALLY_APPROVED,
  CONTENT_CONSENT_DOCUMENT_VERSION,
  contentCaptureAllowed,
};
