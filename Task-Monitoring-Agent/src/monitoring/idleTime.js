// Windows system idle-time detection.
//
// Implementation mirrors activeWindow.js: a short PowerShell script that
// P/Invokes the standard user32.dll `GetLastInputInfo` and the kernel32
// `GetTickCount`, then reports how many seconds have passed since the last
// keyboard or mouse input SYSTEM-WIDE.
//
// This reads ONLY the system's last-input timestamp. It does NOT use keyboard
// or mouse hooks and never sees which keys were pressed or where the mouse
// moved. No third-party dependency is used.

const { execFile } = require("child_process");

const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class AgentIdle {
  [StructLayout(LayoutKind.Sequential)]
  public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  [DllImport("kernel32.dll")] public static extern uint GetTickCount();
}
"@
$lii = New-Object AgentIdle+LASTINPUTINFO
$lii.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lii)
if (-not [AgentIdle]::GetLastInputInfo([ref]$lii)) { '-1'; exit }
$idleMs = [AgentIdle]::GetTickCount() - $lii.dwTime
[Math]::Round($idleMs / 1000)
`;

function encodeCommand(script) {
    return Buffer.from(script, "utf16le").toString("base64");
}

/**
 * @returns {Promise<number|null>} whole seconds since last system input,
 *          or null when it cannot be determined (non-Windows / PowerShell failure).
 */
function getIdleSeconds() {
    if (process.platform !== "win32") {
        return Promise.resolve(null);
    }

    return new Promise((resolve) => {
        execFile(
            "powershell.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-EncodedCommand",
                encodeCommand(PS_SCRIPT),
            ],
            { timeout: 10000, windowsHide: true },
            (err, stdout) => {
                if (err) {
                    resolve(null);
                    return;
                }

                const value = Number(String(stdout).trim());
                if (!Number.isFinite(value) || value < 0) {
                    resolve(null);
                    return;
                }

                resolve(Math.round(value));
            },
        );
    });
}

module.exports = { getIdleSeconds };
