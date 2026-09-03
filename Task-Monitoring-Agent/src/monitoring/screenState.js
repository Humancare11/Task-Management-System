// Windows physical-display power detection (one-shot probe).
//
// DEPRECATED (Phase 3): the activity tracker now reads display power from the
// persistent displayPowerWatcher.js stream instead of spawning this probe every
// poll. Kept for reference / ad-hoc diagnostics; no longer on any hot path.
//
// "Idle" for activity monitoring means exactly one thing: the PHYSICAL DISPLAY
// IS OFF. Not screen lock, not a screensaver, and NEVER keyboard/mouse
// inactivity or a timer. While the display is on — including a long meeting,
// reading, or a presentation with no input — the foreground application keeps
// being tracked. When the display powers off the user is Idle; when it powers
// on again, tracking resumes.
//
// Display power state is event-only on Windows: it is delivered through
// RegisterPowerSettingNotification(GUID_SESSION_DISPLAY_STATUS), which needs a
// window + message pump. Windows delivers the CURRENT state immediately on
// registration, so this probe (mirroring activeWindow.js / idleTime.js) creates
// a hidden window, registers, pumps briefly to capture that first notification,
// reports it, and exits.
//
//   Data value: 0 = display off, 1 = on, 2 = dimmed (treated as on).
//
// Fails open: on a non-Windows platform, any PowerShell failure, or a state
// that cannot be determined, the result is { displayOff: false, determined:
// false } so monitoring never wrongly pauses.
//
// It never reads window contents, keystrokes, the clipboard, the screen, the
// camera or the microphone, and uses no third-party dependency.

const { execFile } = require("child_process");

const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class AgentDisplay : NativeWindow {
  [DllImport("user32.dll", SetLastError = true)]
  static extern IntPtr RegisterPowerSettingNotification(IntPtr hRecipient, ref Guid PowerSettingGuid, uint Flags);
  [DllImport("user32.dll", SetLastError = true)]
  static extern bool UnregisterPowerSettingNotification(IntPtr handle);

  const int WM_POWERBROADCAST = 0x0218;
  const int PBT_POWERSETTINGCHANGE = 0x8013;
  const uint DEVICE_NOTIFY_WINDOW_HANDLE = 0;

  // GUID_SESSION_DISPLAY_STATUS - display power state for this session.
  static Guid DISPLAY_STATUS = new Guid("2B84C20E-AD23-4DDF-93DB-05FFBD7EFCA5");

  [StructLayout(LayoutKind.Sequential)]
  struct POWERBROADCAST_SETTING {
    public Guid PowerSetting;
    public uint DataLength;
    public byte Data;
  }

  IntPtr _reg = IntPtr.Zero;
  public int State = -1;

  public AgentDisplay() {
    CreateHandle(new CreateParams());
    _reg = RegisterPowerSettingNotification(this.Handle, ref DISPLAY_STATUS, DEVICE_NOTIFY_WINDOW_HANDLE);
  }

  protected override void WndProc(ref Message m) {
    if (m.Msg == WM_POWERBROADCAST && m.WParam.ToInt32() == PBT_POWERSETTINGCHANGE && m.LParam != IntPtr.Zero) {
      POWERBROADCAST_SETTING s = (POWERBROADCAST_SETTING)Marshal.PtrToStructure(m.LParam, typeof(POWERBROADCAST_SETTING));
      if (s.PowerSetting == DISPLAY_STATUS) { State = s.Data; }
    }
    base.WndProc(ref m);
  }

  public void Stop() {
    if (_reg != IntPtr.Zero) { UnregisterPowerSettingNotification(_reg); _reg = IntPtr.Zero; }
    if (this.Handle != IntPtr.Zero) { this.DestroyHandle(); }
  }
}
"@

$w = New-Object AgentDisplay
$deadline = [DateTime]::UtcNow.AddMilliseconds(1500)
while ($w.State -lt 0 -and [DateTime]::UtcNow -lt $deadline) {
  [System.Windows.Forms.Application]::DoEvents()
  Start-Sleep -Milliseconds 25
}
$state = $w.State
$w.Stop()
[pscustomobject]@{ display = $state } | ConvertTo-Json -Compress
`;

function encodeCommand(script) {
    return Buffer.from(script, "utf16le").toString("base64");
}

/**
 * Current physical-display power state.
 *
 * Fails open: non-Windows, PowerShell failure, or an undeterminable state all
 * resolve to `{ displayOff: false, determined: false }` so monitoring keeps
 * tracking the foreground application rather than wrongly pausing.
 *
 * @returns {Promise<{ displayOff: boolean, determined: boolean }>}
 */
function getScreenState() {
    const unknown = { displayOff: false, determined: false };

    if (process.platform !== "win32") {
        return Promise.resolve(unknown);
    }

    return new Promise((resolve) => {
        execFile(
            "powershell.exe",
            [
                "-NoProfile",
                "-NonInteractive",
                "-Sta",
                "-ExecutionPolicy",
                "Bypass",
                "-EncodedCommand",
                encodeCommand(PS_SCRIPT),
            ],
            { timeout: 10000, windowsHide: true },
            (err, stdout) => {
                if (err) {
                    resolve(unknown);
                    return;
                }

                let parsed;
                try {
                    parsed = JSON.parse(String(stdout).trim() || "{}");
                } catch {
                    resolve(unknown);
                    return;
                }

                // 0 = off, 1 = on, 2 = dimmed (treat as on), -1/absent = unknown.
                if (parsed.display === 0) {
                    resolve({ displayOff: true, determined: true });
                } else if (parsed.display === 1 || parsed.display === 2) {
                    resolve({ displayOff: false, determined: true });
                } else {
                    resolve(unknown);
                }
            },
        );
    });
}

module.exports = { getScreenState };
