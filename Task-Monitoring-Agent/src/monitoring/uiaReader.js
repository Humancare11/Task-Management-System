// Windows UI Automation reader — the ONLY thing that reads control text for
// §5b content capture.
//
// It reads the FOCUSED element and returns:
//   { text, isPassword, controlType, name, automationId, ariaRole, localizedControlType }
// via a short PowerShell script that loads UIAutomationClient. Best-effort:
//   - non-Windows, PowerShell failure, no focused element, or a non-edit
//     control  -> resolves null.
//   - a password / masked field                    -> { isPassword: true } and
//     the caller MUST NOT use any text.
//
// The name / automationId / ariaRole / localizedControlType fields let the
// caller decide whether the focused control is a SEARCH / QUERY field (all-site
// capture only stores text from fields that look like search boxes). They are
// element metadata, never page content or keystrokes.
//
// It never reads anything but the focused element, never reads keystrokes, and
// never walks the tree looking for other fields.

const { execFile } = require("child_process");

const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
try {
  $el = [System.Windows.Automation.AutomationElement]::FocusedElement
  if ($el -eq $null) { '{}'; exit }

  $ct = $el.Current.ControlType.ProgrammaticName
  $isPw = $false
  try { $isPw = [bool]$el.Current.IsPassword } catch {}

  $name = ''
  try { $name = [string]$el.Current.Name } catch {}
  $autoId = ''
  try { $autoId = [string]$el.Current.AutomationId } catch {}
  $lct = ''
  try { $lct = [string]$el.Current.LocalizedControlType } catch {}
  $aria = ''
  try { $aria = [string]$el.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::AriaRoleProperty) } catch {}

  # Only edit-like controls are of interest.
  $editish = @('ControlType.Edit','ControlType.Document','ControlType.ComboBox')
  if ($editish -notcontains $ct) {
    [pscustomobject]@{ text=''; isPassword=$isPw; controlType=$ct; name=$name; automationId=$autoId; ariaRole=$aria; localizedControlType=$lct } | ConvertTo-Json -Compress
    exit
  }

  $text = ''
  if (-not $isPw) {
    try {
      $vp = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
      if ($vp) { $text = $vp.Current.Value }
    } catch {}
    if ([string]::IsNullOrEmpty($text)) {
      try {
        $tp = $el.GetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern)
        if ($tp) { $text = $tp.DocumentRange.GetText(4000) }
      } catch {}
    }
  }
  [pscustomobject]@{ text=$text; isPassword=$isPw; controlType=$ct; name=$name; automationId=$autoId; ariaRole=$aria; localizedControlType=$lct } | ConvertTo-Json -Compress
} catch {
  '{}'
}
`;

function encodeCommand(script) {
    return Buffer.from(script, "utf16le").toString("base64");
}

/**
 * @returns {Promise<{ text:string, isPassword:boolean, controlType:string,
 *   name:string, automationId:string, ariaRole:string,
 *   localizedControlType:string } | null>}
 */
function readFocusedField() {
    if (process.platform !== "win32") return Promise.resolve(null);

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
            { timeout: 8000, windowsHide: true, maxBuffer: 1024 * 1024 },
            (err, stdout) => {
                if (err) return resolve(null);
                let parsed;
                try {
                    parsed = JSON.parse(String(stdout).trim() || "{}");
                } catch {
                    return resolve(null);
                }
                if (typeof parsed.controlType !== "string") return resolve(null);
                resolve({
                    text: typeof parsed.text === "string" ? parsed.text : "",
                    isPassword: Boolean(parsed.isPassword),
                    controlType: parsed.controlType,
                    name: typeof parsed.name === "string" ? parsed.name : "",
                    automationId:
                        typeof parsed.automationId === "string" ? parsed.automationId : "",
                    ariaRole: typeof parsed.ariaRole === "string" ? parsed.ariaRole : "",
                    localizedControlType:
                        typeof parsed.localizedControlType === "string"
                            ? parsed.localizedControlType
                            : "",
                });
            },
        );
    });
}

module.exports = { readFocusedField };
