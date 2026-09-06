# Deploying the monitoring extension

The extension only works alongside the desktop Monitoring Agent (it talks to the
agent over Chrome native messaging). Deploy both together.

There are three pieces to put in place:

1. **The extension**, force-installed via managed browser policy.
2. **The native messaging host manifest**, so Chrome/Edge will launch the
   agent's bridge process for our extension.
3. **A pinned extension ID**, so the native host manifest's `allowed_origins`
   and the policy's forcelist both refer to the same extension.

---

## 1. Pin the extension ID

Chrome derives the extension ID from a public key in the manifest. Generate one
once and keep the private key safe (offline).

```bash
# generate a key pair (once, keep key.pem private and offline)
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
# the value to paste into manifest.json as "key":
openssl rsa -in key.pem -pubout -outform DER | base64 -w0
```

Add to `manifest.json` (and rebuild):

```json
{ "manifest_version": 3, "key": "<the base64 DER public key>", ... }
```

Load `dist/` unpacked once in Chrome → `chrome://extensions` shows the ID. That
ID is now stable across every machine. Call it `EXT_ID` below.

For distribution, publish `dist/` (zipped) to the Chrome Web Store as an
**unlisted / private** item under the org's developer account, or host the
`.crt`/update manifest yourself and use `ExtensionInstallForcelist` with the
update URL. The Web Store route is simplest for Edge too (Edge can install from
the Chrome Web Store).

---

## 2. Force-install policy

### Chrome (Windows, Group Policy / Intune)

Registry (or the equivalent ADMX policy):

```
HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist
  1 = "EXT_ID;https://clients2.google.com/service/update2/crx"
```

### Edge

```
HKLM\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist
  1 = "EXT_ID;https://edge.microsoft.com/extensionwebstorebase/v1/crx"
```

Force-installed extensions cannot be disabled or removed by the user, and
`nativeMessaging` is granted without a prompt.

Also allow our native host explicitly (some managed configs block native
messaging by default):

```
HKLM\SOFTWARE\Policies\Google\Chrome\NativeMessagingAllowlist
  1 = "co.humancareconnect.monitoring"
```

---

## 3. Native messaging host

The agent installer ships a wrapper the manifest points at. On Windows the
manifest `path` must be an executable; we ship a `.bat` that runs the bridge
script through the agent's bundled Electron (as plain Node):

`native-host.bat` (installed next to the agent, e.g. `C:\Program Files\HumanCare Monitoring\`):

```bat
@echo off
set ELECTRON_RUN_AS_NODE=1
"%~dp0HumanCareMonitoring.exe" "%~dp0resources\app\src\monitoring\extension\nativeHost.js" %*
```

Host manifest `co.humancareconnect.monitoring.json` (installed anywhere the
agent can write, e.g. alongside the agent):

```json
{
  "name": "co.humancareconnect.monitoring",
  "description": "HumanCare Connect monitoring bridge",
  "path": "C:\\Program Files\\HumanCare Monitoring\\native-host.bat",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://EXT_ID/"]
}
```

Register it (per-user; the agent installer can do this, or a login script):

```
HKCU\Software\Google\Chrome\NativeMessagingHosts\co.humancareconnect.monitoring
  (Default) = "C:\Program Files\HumanCare Monitoring\co.humancareconnect.monitoring.json"

HKCU\Software\Microsoft\Edge\NativeMessagingHosts\co.humancareconnect.monitoring
  (Default) = "C:\Program Files\HumanCare Monitoring\co.humancareconnect.monitoring.json"
```

---

## How it runs

- Agent starts → `bridgeServer.start()` opens the pipe
  `\\.\pipe\co.humancareconnect.monitoring` and writes a token to
  `%USERPROFILE%\.humancare-monitoring\ext-bridge.json` (0600).
- Chrome/Edge starts → force-installs the extension → its background worker
  calls `connectNative("co.humancareconnect.monitoring")` → Chrome runs
  `native-host.bat` → `nativeHost.js` reads the token file and connects to the
  pipe.
- The heartbeat says `content_capture.active === true` → the agent calls
  `extensionBridge.setState({enabled:true, blocklist})` → the bridge pushes
  that to the extension → it starts forwarding search/prompt commits.
- Everything downstream (consent version check, blocklist re-check, encryption,
  retention, audit) is exactly the same as the agent's own UIA capture path.

## Verifying on one machine

1. Agent running, extension force-installed, heartbeat shows capture active.
2. `chrome://extensions` → the extension has no errors; its service worker is
   "active".
3. Do a search on any site → within one flush interval it appears in the
   dashboard's Search & Prompt Content.
4. Do a search in an Incognito window → it must NOT appear.
5. Do a search on a bank site → it must NOT appear.
6. Agent log shows the periodic `Content capture stats` line with a rising
   `captured` / `sent`.
