// Website/domain detection for supported desktop web browsers (Step 17).
//
// When the active foreground application is a supported browser, this module
// reads ONLY the browser's address-bar value via Windows UI Automation
// (the same accessibility API screen readers use) and normalizes it to a
// registrable-style hostname such as "youtube.com".
//
// It deliberately does NOT:
//   - read browser history or history databases
//   - read page contents, cookies, saved passwords or form data
//   - keep full URLs, query strings or path segments
//   - touch the keyboard, mouse, clipboard, screen, camera or microphone
//
// Only the normalized domain is returned. Anything uncertain returns null.
// No third-party dependency is used: UIAutomationClient / UIAutomationTypes
// ship with the .NET Framework on every supported version of Windows.

const { execFile } = require("child_process");

// Substrings matched (case-insensitive) against the active application name
// (process description, e.g. "Google Chrome") or process name.
const SUPPORTED_BROWSER_MATCHERS = [
    "chrome",
    "edge",
    "firefox",
    "brave",
    "opera",
    "vivaldi",
    "chromium",
];

function isSupportedBrowser(applicationName) {
    if (!applicationName || typeof applicationName !== "string") return false;
    const name = applicationName.toLowerCase();
    return SUPPORTED_BROWSER_MATCHERS.some((m) => name.includes(m));
}

// Canonical browser id for the events pipeline ("chrome", "edge", ...). Order
// matters: "Microsoft Edge" is Chromium-based but must not be reported as
// chrome. Returns null when the application is not a supported browser.
const BROWSER_ID_ORDER = [
    "edge",
    "chrome",
    "firefox",
    "brave",
    "opera",
    "vivaldi",
    "chromium",
];

function canonicalBrowser(applicationName) {
    if (!applicationName || typeof applicationName !== "string") return null;
    const name = applicationName.toLowerCase();
    for (const id of BROWSER_ID_ORDER) {
        if (name.includes(id)) return id;
    }
    return null;
}

/**
 * Normalize a raw address-bar value (a full URL, or a bare host as Chrome
 * shows it) to a lower-case registrable-style hostname. Returns null when the
 * value is not a usable web host (search text, internal page, localhost, ...).
 */
function normalizeDomain(raw) {
    if (!raw || typeof raw !== "string") return null;
    let value = raw.trim();
    if (!value) return null;

    // Bare host / host+path without a scheme -> assume http for parsing only.
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
        value = `http://${value}`;
    }

    let host;
    try {
        const url = new URL(value);
        // Only http(s) pages carry a meaningful website domain.
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        host = url.hostname;
    } catch {
        return null;
    }

    if (!host) return null;
    host = host.toLowerCase().replace(/\.+$/, "");
    if (host.startsWith("www.")) host = host.slice(4);

    // Must look like "label.tld" (or deeper) with a real alphabetic TLD.
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host)) return null;
    if (host === "localhost") return null;

    // Registrable domain heuristic (no Public Suffix List dependency):
    // keep the last two labels, but keep three for common two-level ccTLDs.
    const labels = host.split(".");
    if (labels.length <= 2) return host;
    const lastTwo = labels.slice(-2).join(".");
    const multiPartTlds = new Set([
        "co.uk", "org.uk", "gov.uk", "ac.uk", "co.in", "co.jp", "com.au",
        "com.br", "co.nz", "co.za", "com.sg",
    ]);
    if (multiPartTlds.has(lastTwo)) return labels.slice(-3).join(".");
    return lastTwo;
}

const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class AgentFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
}
"@
$h = [AgentFg]::GetForegroundWindow()
if ($h -eq [IntPtr]::Zero) { '{}'; exit }
$procId = 0
[void][AgentFg]::GetWindowThreadProcessId($h, [ref]$procId)
$p = Get-Process -Id $procId -ErrorAction SilentlyContinue
if (-not $p) { '{}'; exit }
$pn = $p.ProcessName.ToLower()
$browsers = @('chrome','msedge','firefox','brave','opera','vivaldi','chromium')
$ok = $false
foreach ($b in $browsers) { if ($pn -like "*$b*") { $ok = $true } }
if (-not $ok) { '{}'; exit }
try {
  Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
  Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop
} catch { '{}'; exit }
$root = [System.Windows.Automation.AutomationElement]::FromHandle($h)
if (-not $root) { '{}'; exit }
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
$edits = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
$vals = New-Object System.Collections.ArrayList
foreach ($e in $edits) {
  $vp = $null
  if ($e.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) {
    $v = $vp.Current.Value
    if ($v) { [void]$vals.Add([string]$v) }
  }
}
[pscustomobject]@{ values = $vals } | ConvertTo-Json -Compress
`;

function encodeCommand(script) {
    return Buffer.from(script, "utf16le").toString("base64");
}

/**
 * Determine the active website/domain for a supported browser.
 * @param {{applicationName?:string}|null} active  the current active-window sample
 * @returns {Promise<string|null>} normalized domain, or null when not a
 *          supported browser / not determinable / uncertain.
 */
function getActiveDomain(active) {
    if (process.platform !== "win32") return Promise.resolve(null);
    if (!active || !isSupportedBrowser(active.applicationName)) {
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
                let values = parsed.values;
                if (typeof values === "string") values = [values];
                if (!Array.isArray(values)) {
                    resolve(null);
                    return;
                }
                for (const value of values) {
                    const domain = normalizeDomain(value);
                    if (domain) {
                        resolve(domain);
                        return;
                    }
                }
                resolve(null);
            },
        );
    });
}

module.exports = {
    getActiveDomain,
    isSupportedBrowser,
    canonicalBrowser,
    normalizeDomain,
};
