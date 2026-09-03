// §5b consent cache (Electron main process only).
//
// Records that THIS employee accepted a specific version of the content-capture
// consent document, so the agent doesn't re-prompt every launch. This is a
// convenience cache only — the SERVER's monitoring_consents row is the source of
// truth, and content capture never runs unless the server heartbeat confirms
// consent independently.

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const FILE_NAME = "agent-content-consent.json";

function filePath() {
    return path.join(app.getPath("userData"), FILE_NAME);
}

/** @returns {{ documentVersion:string, acceptedAt:string } | null} */
function loadConsent() {
    try {
        const data = JSON.parse(fs.readFileSync(filePath(), "utf8"));
        if (data && typeof data.documentVersion === "string") return data;
        return null;
    } catch {
        return null;
    }
}

function hasConsentFor(documentVersion) {
    const c = loadConsent();
    return Boolean(c && documentVersion && c.documentVersion === documentVersion);
}

function saveConsent(documentVersion) {
    const payload = {
        documentVersion: String(documentVersion),
        acceptedAt: new Date().toISOString(),
    };
    fs.writeFileSync(filePath(), JSON.stringify(payload, null, 2), { mode: 0o600 });
    return payload;
}

function clearConsent() {
    try {
        fs.unlinkSync(filePath());
    } catch {
        /* already absent */
    }
}

module.exports = { filePath, loadConsent, hasConsentFor, saveConsent, clearConsent };
