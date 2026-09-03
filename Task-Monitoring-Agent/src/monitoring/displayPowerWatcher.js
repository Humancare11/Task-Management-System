// Persistent physical-display-power watcher (Phase 3).
//
// Replaces the per-poll PowerShell probe (screenState.js) with ONE long-lived
// PowerShell process that registers RegisterPowerSettingNotification(
// GUID_SESSION_DISPLAY_STATUS) and streams one line per real change on stdout.
// The activity poll then reads the cached value synchronously — no process
// spawn, no ~1s stall every tick.
//
//   Data value: 0 = display off, 1 = on, 2 = dimmed (treated as on).
//
// Fails open: before the first reading, on any spawn/parse failure, on a
// non-Windows platform, or while the helper is being restarted, current()
// reports { displayOff: false, determined: false } so monitoring never wrongly
// pauses. A dead helper is respawned with capped exponential backoff.
//
// It never reads window contents, keystrokes, the clipboard, the screen, the
// camera or the microphone, and uses no third-party dependency.

const { spawn, execFile } = require("child_process");
const logger = require("../utils/logger");

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
$last = -1
while ($true) {
  [System.Windows.Forms.Application]::DoEvents()
  if ($w.State -ge 0 -and $w.State -ne $last) {
    $last = $w.State
    [Console]::Out.WriteLine('{"display":' + $last + '}')
    [Console]::Out.Flush()
  }
  Start-Sleep -Milliseconds 200
}
`;

function encodeCommand(script) {
    return Buffer.from(script, "utf16le").toString("base64");
}

const RESTART_BASE_MS = 2000;
const RESTART_MAX_MS = 60000;

class DisplayPowerWatcher {
    constructor({ onChange } = {}) {
        this.onChange = typeof onChange === "function" ? onChange : null;
        this._child = null;
        this._buf = "";
        this._displayOff = false;
        this._determined = false;
        this._stopped = true;
        this._restarts = 0;
        this._restartTimer = null;
    }

    /** Current cached reading. Fails open until the helper reports. */
    current() {
        return { displayOff: this._displayOff, determined: this._determined };
    }

    start() {
        if (process.platform !== "win32") {
            logger.info("Display power watcher: non-Windows platform — display is assumed on.");
            return;
        }
        this._stopped = false;
        this._spawn();
    }

    stop() {
        this._stopped = true;
        if (this._restartTimer) {
            clearTimeout(this._restartTimer);
            this._restartTimer = null;
        }
        this._kill();
        // A stopped watcher no longer knows the state.
        this._determined = false;
    }

    _spawn() {
        if (this._stopped) return;
        try {
            const child = spawn(
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
                { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
            );
            this._child = child;

            child.stdout.setEncoding("utf8");
            child.stdout.on("data", (chunk) => this._onData(chunk));
            child.on("error", (err) => {
                logger.warn(`Display power watcher: spawn error (${err.message}).`);
                this._onExit();
            });
            child.on("exit", () => this._onExit());

            logger.info("Display power watcher started (persistent power-setting notification).");
        } catch (err) {
            logger.warn(`Display power watcher: failed to start (${err.message}).`);
            this._scheduleRestart();
        }
    }

    _onData(chunk) {
        this._buf += chunk;
        let nl;
        // eslint-disable-next-line no-cond-assign
        while ((nl = this._buf.indexOf("\n")) !== -1) {
            const line = this._buf.slice(0, nl).trim();
            this._buf = this._buf.slice(nl + 1);
            if (!line) continue;
            let parsed;
            try {
                parsed = JSON.parse(line);
            } catch {
                continue;
            }
            this._applyReading(parsed.display);
        }
        // A healthy helper means the last spawn succeeded — reset backoff.
        this._restarts = 0;
    }

    _applyReading(value) {
        let displayOff;
        if (value === 0) displayOff = true;
        else if (value === 1 || value === 2) displayOff = false;
        else return; // -1 / unknown — keep whatever we had

        const changed = !this._determined || displayOff !== this._displayOff;
        this._displayOff = displayOff;
        this._determined = true;
        if (changed && this.onChange) {
            try {
                this.onChange(this.current());
            } catch (err) {
                logger.warn(`Display power watcher onChange failed: ${err.message}`);
            }
        }
    }

    _onExit() {
        this._child = null;
        this._buf = "";
        if (this._stopped) return;
        this._determined = false; // fail open while we have no helper
        logger.warn("Display power watcher: helper exited — restarting.");
        this._scheduleRestart();
    }

    _scheduleRestart() {
        if (this._stopped || this._restartTimer) return;
        const delay = Math.min(
            RESTART_BASE_MS * 2 ** Math.min(this._restarts, 5),
            RESTART_MAX_MS,
        );
        this._restarts += 1;
        this._restartTimer = setTimeout(() => {
            this._restartTimer = null;
            this._spawn();
        }, delay);
        if (this._restartTimer.unref) this._restartTimer.unref();
    }

    _kill() {
        const child = this._child;
        this._child = null;
        if (!child || child.killed) return;
        try {
            child.kill();
        } catch {
            /* ignore */
        }
        // PowerShell running an infinite DoEvents loop can ignore a plain
        // signal — force the tree down on Windows.
        if (process.platform === "win32" && child.pid) {
            execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => {});
        }
    }
}

module.exports = { DisplayPowerWatcher };
