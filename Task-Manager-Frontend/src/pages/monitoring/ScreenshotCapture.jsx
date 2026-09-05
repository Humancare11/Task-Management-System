import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Camera, Download, Loader2, ImageOff } from "lucide-react";
import { getSocket } from "../../lib/socket.js";

// Screenshot — a SEPARATE feature from Live Screen. One click requests a
// single still picture of the employee's current screen; it has NO WebRTC
// dependency at all (no peer connection, no ICE/STUN/TURN), so it keeps
// working even when Live Screen's peer-to-peer video cannot connect.
//
// Signaling rides the existing socket.io connection:
//   emit  screenshot:request {targetUserId}  -> ack {ok, requestId} | {ok:false, code}
//   on    screenshot:ready   {requestId, image (base64), mimeType}
//   on    screenshot:error   {requestId, code}
//
// The image arrives once, as a base64 payload over the socket, and is turned
// into a blob: object URL held ONLY in this component's state. It is never
// written to localStorage/sessionStorage/IndexedDB, never re-sent anywhere,
// and the object URL is explicitly revoked when the modal closes, the request
// is retried, or the component unmounts — so nothing outlives this view.
// Downloading saves the file only to the viewer's own device, same as any
// other browser download.

const REQUEST_ERRORS = {
  not_enabled: "Screenshot is not enabled for this organization yet.",
  not_authorized: "You are not authorized to view this employee's screen.",
  consent_missing: "The employee has not yet accepted the screen-visibility notice.",
  agent_offline: "The employee's agent is offline.",
  bad_request: "Could not start the request.",
  unauthenticated: "Your session is missing organization context — sign in again.",
  not_ready:
    "Screenshot isn't set up on the server (database migrations not applied). Ask an admin to run the pending migrations.",
  server_error: "Server error requesting the screenshot.",
};
const CAPTURE_ERRORS = {
  agent_unavailable: "The agent did not respond in time — it may be offline or busy.",
  denied: "The request was denied.",
  empty_capture: "The agent could not capture a screen.",
  capture_failed: "The agent failed to capture a screenshot.",
  timeout: "Timed out waiting for a response.",
};

// Slightly longer than the backend's own SCREENSHOT_REQUEST_TIMEOUT_MS
// (default 20s) so the server's own timeout message wins in the common case.
const CLIENT_TIMEOUT_MS = 25 * 1000;

function screenshotFilename(employeeName, when) {
  const safeName =
    String(employeeName || "employee")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "employee";
  const ts = when.toISOString().replace(/[:.]/g, "-");
  return `screenshot-${safeName}-${ts}.png`;
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || "image/png" });
}

export default function ScreenshotCapture({ open, targetUserId, employeeName, onClose }) {
  const requestIdRef = useRef(null);
  const timeoutRef = useRef(null);
  const imageUrlRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // requesting | waiting | ready | error
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [image, setImage] = useState(null); // { url, capturedAt } | null

  const clearImage = useCallback(() => {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }
    setImage(null);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const socket = getSocket();
    let cancelled = false;

    setPhase("requesting");
    setMessage("");
    clearImage();

    const clearGuard = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const onReady = ({ requestId, image: base64, mimeType }) => {
      if (cancelled || requestId !== requestIdRef.current) return;
      clearGuard();
      try {
        const blob = base64ToBlob(base64, mimeType);
        if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
        const url = URL.createObjectURL(blob);
        imageUrlRef.current = url;
        setImage({ url, capturedAt: new Date() });
        setPhase("ready");
      } catch (err) {
        setPhase("error");
        setMessage(`Could not read the captured image: ${err.message}`);
      }
    };
    const onError = ({ requestId, code }) => {
      if (cancelled || requestId !== requestIdRef.current) return;
      clearGuard();
      setPhase("error");
      setMessage(CAPTURE_ERRORS[code] || "The screenshot could not be captured.");
    };

    socket.on("screenshot:ready", onReady);
    socket.on("screenshot:error", onError);

    socket.emit("screenshot:request", { targetUserId }, (ack) => {
      if (cancelled) return;
      if (!ack || !ack.ok) {
        setPhase("error");
        setMessage(
          (ack && ack.detail) ||
            REQUEST_ERRORS[ack && ack.code] ||
            "Could not request the screenshot.",
        );
        return;
      }
      requestIdRef.current = ack.requestId;
      setPhase("waiting");
      timeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        setPhase("error");
        setMessage(CAPTURE_ERRORS.timeout);
      }, CLIENT_TIMEOUT_MS);
    });

    return () => {
      cancelled = true;
      clearGuard();
      socket.off("screenshot:ready", onReady);
      socket.off("screenshot:error", onError);
      requestIdRef.current = null;
      clearImage();
    };
  }, [open, targetUserId, attempt, clearImage]);

  if (!open) return null;

  const statusLine =
    {
      requesting: "Requesting screenshot…",
      waiting: "Waiting for the employee's device…",
      error: message || "Error.",
    }[phase] || "";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-hair bg-surface-1 shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-hair px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Camera size={15} className="shrink-0 text-txt-muted" />
            <h2 className="truncate font-display text-sm font-semibold text-txt-primary">
              Screenshot — {employeeName || "Employee"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
            aria-label="Close"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative flex min-h-[220px] items-center justify-center bg-black">
          {image ? (
            <img src={image.url} alt="Captured screen" className="max-h-[70vh] w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-txt-muted">
              {phase === "error" ? (
                <ImageOff size={28} />
              ) : (
                <Loader2 size={28} className="animate-spin" />
              )}
              <p className="max-w-sm text-xs">{statusLine}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-hair px-4 py-3 text-[11px] text-txt-muted">
          <span className="min-w-0 truncate">
            {image
              ? `Captured ${image.capturedAt.toLocaleTimeString()} · one still image · not saved anywhere until you download it`
              : "One-time capture · not a live stream · no video connection required"}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {phase === "error" && (
              <button
                onClick={() => {
                  setMessage("");
                  setPhase("requesting");
                  setAttempt((n) => n + 1);
                }}
                className="rounded-md border border-accentblue/40 bg-accentblue/10 px-3 py-1.5 text-xs font-semibold text-accentblue hover:bg-accentblue/20"
              >
                Retry
              </button>
            )}
            {image && (
              <a
                href={image.url}
                download={screenshotFilename(employeeName, image.capturedAt)}
                className="flex items-center gap-1 rounded-md border border-accentblue/40 bg-accentblue/10 px-3 py-1.5 text-xs font-semibold text-accentblue hover:bg-accentblue/20"
              >
                <Download size={13} /> Download
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-md border border-hair px-3 py-1.5 text-xs font-semibold text-txt-primary hover:bg-surface-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
