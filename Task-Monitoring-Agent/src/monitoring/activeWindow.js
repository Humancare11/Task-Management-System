// Windows active-window detection.
//
// Implementation: a short PowerShell script that P/Invokes the standard
// user32.dll functions (GetForegroundWindow / GetWindowThreadProcessId /
// GetWindowText) and maps the owning process id to a friendly name via
// Get-Process. No third-party dependency is used — this relies only on
// PowerShell, which ships with every supported version of Windows.
//
// It collects ONLY:
//   - application_name (process description, else process name)
//   - window_title    (the foreground window's title bar text)
//
// It never reads window contents, URLs, keystrokes, clipboard, or process
// command-line arguments.

const { execFile } = require("child_process");

const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class AgentWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
  [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
}
"@
$h = [AgentWin]::GetForegroundWindow()
if ($h -eq [IntPtr]::Zero) { '{}' ; exit }
$len = [AgentWin]::GetWindowTextLength($h)
$sb = New-Object System.Text.StringBuilder ($len + 1)
[void][AgentWin]::GetWindowText($h, $sb, $sb.Capacity)
$procId = 0
[void][AgentWin]::GetWindowThreadProcessId($h, [ref]$procId)
$p = Get-Process -Id $procId -ErrorAction SilentlyContinue
$name = ''
if ($p) { if ($p.Description) { $name = $p.Description } else { $name = $p.ProcessName } }
[pscustomobject]@{ title = $sb.ToString(); application = $name } | ConvertTo-Json -Compress
`;

function encodeCommand(script) {
    return Buffer.from(script, "utf16le").toString("base64");
}

/**
 * @returns {Promise<{ applicationName: string, windowTitle: string } | null>}
 *          null when nothing can be determined (no foreground window, non-Windows,
 *          or PowerShell failure).
 */
function getActiveWindow() {
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

                let parsed;
                try {
                    parsed = JSON.parse(String(stdout).trim() || "{}");
                } catch {
                    resolve(null);
                    return;
                }

                const applicationName = (parsed.application || "").trim();
                const windowTitle = (parsed.title || "").trim();

                if (!applicationName && !windowTitle) {
                    resolve(null);
                    return;
                }

                resolve({
                    applicationName: applicationName || "Unknown",
                    windowTitle,
                });
            },
        );
    });
}

module.exports = { getActiveWindow };
