// Electron-only persisted store for the credentials entered in the first-time
// setup UI.
//
//   - The Agent Secret is encrypted with Electron's safeStorage (Windows DPAPI,
//     scoped to the current OS user) before it touches the disk.
//   - Non-secret fields (API URL, Agent UUID, optional device name) are stored
//     in plaintext JSON alongside it.
//   - The file lives in app.getPath("userData"), NOT in the repo, so it never
//     interferes with the CLI/headless config (env vars + agent.config.json).
//
// This module must only be required from the Electron main process.

const fs = require("fs");
const path = require("path");
const { app, safeStorage } = require("electron");

const FILE_NAME = "agent-credentials.json";

function configFilePath() {
    return path.join(app.getPath("userData"), FILE_NAME);
}

function encryptionAvailable() {
    try {
        return safeStorage.isEncryptionAvailable();
    } catch {
        return false;
    }
}

function readRaw() {
    try {
        return JSON.parse(fs.readFileSync(configFilePath(), "utf8"));
    } catch {
        return null;
    }
}

// True when a previous setup wrote a structurally complete record. Does not
// attempt decryption — use loadSecureConfig() for that.
function hasSecureConfig() {
    const data = readRaw();
    return !!(data && data.apiBaseUrl && data.agentUuid && data.secret_enc);
}

// Returns { apiBaseUrl, agentUuid, agentSecret, deviceName } or null when there
// is no usable record (missing file, corrupt file, encryption unavailable, or a
// failed decrypt — e.g. the file was copied from another machine/user).
function loadSecureConfig() {
    const data = readRaw();
    if (!data || !data.apiBaseUrl || !data.agentUuid || !data.secret_enc) {
        return null;
    }
    if (!encryptionAvailable()) {
        return null;
    }

    let agentSecret;
    try {
        agentSecret = safeStorage.decryptString(
            Buffer.from(data.secret_enc, "base64"),
        );
    } catch {
        return null;
    }
    if (!agentSecret) return null;

    return {
        apiBaseUrl: data.apiBaseUrl,
        agentUuid: data.agentUuid,
        agentSecret,
        deviceName: data.deviceName || null,
    };
}

// Persists the record. Throws "secure-storage-unavailable" rather than writing
// the secret in plaintext when safeStorage cannot encrypt.
function saveSecureConfig({ apiBaseUrl, agentUuid, agentSecret, deviceName }) {
    if (!encryptionAvailable()) {
        throw new Error("secure-storage-unavailable");
    }

    const payload = {
        apiBaseUrl,
        agentUuid,
        secret_enc: safeStorage
            .encryptString(String(agentSecret))
            .toString("base64"),
        deviceName: deviceName || null,
        savedAt: new Date().toISOString(),
    };

    fs.writeFileSync(configFilePath(), JSON.stringify(payload, null, 2), {
        mode: 0o600,
    });
}

function clearSecureConfig() {
    try {
        fs.unlinkSync(configFilePath());
    } catch {
        /* already absent */
    }
}

module.exports = {
    configFilePath,
    encryptionAvailable,
    hasSecureConfig,
    loadSecureConfig,
    saveSecureConfig,
    clearSecureConfig,
};
