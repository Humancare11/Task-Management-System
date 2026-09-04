"use strict";

/**
 * §5b consent document — the SINGLE SOURCE OF TRUTH for the notice shown to
 * employees and recorded in monitoring_consents.
 *
 * The desktop agent fetches this exact text (via the heartbeat) and displays it
 * on the consent screen; on "I Accept" the agent posts CONTENT_CONSENT_DOCUMENT_VERSION
 * back and the server writes a monitoring_consents row against it.
 *
 * ── Changing the notice ──────────────────────────────────────────────────────
 * If the wording changes in any material way, BUMP CONTENT_CONSENT_DOCUMENT_VERSION.
 * Existing consents no longer satisfy the check until each employee re-accepts
 * the new version — the agent re-prompts automatically. Use a sortable version
 * string, e.g. "2026-11-01.v2".
 * ────────────────────────────────────────────────────────────────────────────
 *
 * NOTE: content capture still does NOT run until CONTENT_CAPTURE_LEGALLY_APPROVED
 * (config/contentCaptureGate.js) is set true, the encryption key registry is
 * configured, and the organization enables it. Recording consent here does not
 * start any capture.
 *
 * ── v2 (2026-09-04) ─────────────────────────────────────────────────────────
 * Scope widened from a fixed five-site list to: search queries typed into a
 * search box on ANY website (except the protected categories below), plus
 * prompts to the named AI assistants. This is a material change, so the version
 * is bumped — every employee is re-prompted and their capture pauses until they
 * accept v2. The prior narrow-scope legal approval no longer applies; the
 * legal gate has been returned to closed pending fresh review.
 */

const CONTENT_CONSENT_DOCUMENT_VERSION = "2026-09-04.v2";

const CONTENT_CONSENT_DOCUMENT_TITLE =
  "Notice & Consent — Recording of Search Queries and AI Assistant Prompts";

const CONTENT_CONSENT_DOCUMENT_TEXT = `Your employer already runs activity monitoring on this computer (active
application, website domains, idle and screen-off time). Your employer is asking
for your consent to additionally record TWO more things:

  • the text you type into a search box on any website you visit — your search
    queries; and
  • the prompts you send to AI assistants (ChatGPT, Claude, and Gemini).

That is all that is recorded from your typing: your search queries and your AI
prompts. It is only captured from a field that is identified as a search or
query box, or from an AI assistant's prompt box.

WHAT IS NOT RECORDED
  • The contents of web pages, documents, messages, or emails.
  • Passwords, PINs, card numbers, or any field the browser shows as masked.
  • Any other form field (names, addresses, comments, message boxes, and so on),
    or anything you type in any other application.
  • Anything at all on banking, payment, healthcare, or government websites —
    these categories are always excluded from this recording.
  • Anything at all in a private / incognito / InPrivate browser window.

HOW IT IS HANDLED
  • Recorded text is encrypted before it is stored. There is no readable copy.
  • It is automatically and permanently deleted after your organization's
    retention period (between 30 and 90 days).
  • Only the organization owner can view it by default. Any other reviewer needs
    a specific, time-limited authorization. Every single view is logged with who
    looked, when, and for which date range.

YOUR CHOICE
  • "I Accept" turns on this additional recording for your account.
  • "I Decline", or closing this window, means none of your search queries or
    prompts are recorded. Your existing activity monitoring is unaffected either
    way, and declining has no other effect here.
  • You can withdraw this consent at any time by contacting your manager or HR;
    recording stops when your consent is withdrawn.

By choosing "I Accept" you confirm that you have read this notice and consent to
the recording described above.`;

module.exports = {
  CONTENT_CONSENT_DOCUMENT_VERSION,
  CONTENT_CONSENT_DOCUMENT_TITLE,
  CONTENT_CONSENT_DOCUMENT_TEXT,
};
