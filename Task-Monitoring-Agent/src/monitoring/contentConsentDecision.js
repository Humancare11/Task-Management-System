// Pure decision function for the §5b consent / capture state machine.
//
// Given the heartbeat's `content_capture` signal and the agent's local state,
// decide three things:
//   capture       "on"  -> start the capture runner   (server confirmed active)
//                 "off" -> stop it / keep it stopped
//   prompt        null, or { version, title, text } -> show the consent notice
//   cacheConsent  true  -> the server says this user consented but we have no
//                          local cache yet; write one so we stop re-prompting
//
// Capture is turned "on" ONLY when signal.active === true, which the server sets
// only when the legal gate is open AND the org enabled capture AND a
// monitoring_consents row exists. The consent PROMPT, by contrast, is shown as
// soon as the org enables capture (signal.consent_required) so acceptances can
// be gathered before the legal gate is flipped. Declining or closing the window
// simply never produces a consent row, so capture never becomes active.

/**
 * @param {object|null} signal   heartbeat content_capture block
 * @param {object} ctx
 * @param {string|null} ctx.promptedVersion       version already shown this session
 * @param {(v:string)=>boolean} ctx.hasLocalConsent
 * @returns {{ capture: "on"|"off", prompt: null|{version:string,title:string,text:string}, cacheConsent: boolean }}
 */
function decideContentAction(signal, ctx) {
  const hasLocalConsent =
    ctx && typeof ctx.hasLocalConsent === "function" ? ctx.hasLocalConsent : () => false;
  const promptedVersion = (ctx && ctx.promptedVersion) || null;

  if (!signal || typeof signal !== "object") {
    return { capture: "off", prompt: null, cacheConsent: false };
  }

  if (signal.active === true) {
    const version = signal.document_version || null;
    return {
      capture: "on",
      prompt: null,
      cacheConsent: Boolean(version) && !hasLocalConsent(version),
    };
  }

  let prompt = null;
  const version = signal.document_version || null;
  const needConsent =
    signal.consent_required === true &&
    signal.consented !== true &&
    Boolean(version) &&
    typeof signal.document_text === "string" &&
    signal.document_text.trim().length > 0;

  if (needConsent && promptedVersion !== version && !hasLocalConsent(version)) {
    prompt = {
      version,
      title:
        typeof signal.document_title === "string" && signal.document_title.trim()
          ? signal.document_title.trim()
          : "Consent Required",
      text: signal.document_text,
    };
  }

  return { capture: "off", prompt, cacheConsent: false };
}

module.exports = { decideContentAction };
