import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, MonitorOff, Loader2, Wifi } from "lucide-react";
import { getSocket } from "../../lib/socket.js";

// Live Screen viewer.
//
// The employer sees the employee's screen live over a peer-to-peer WebRTC
// connection. The agent is the OFFERER (it owns the screen capture); this
// component is the ANSWERER. Nothing is recorded: the MediaStream is attached
// straight to a <video> element and is dropped when the modal closes.
//
// Signaling rides the existing socket.io connection:
//   emit  livescreen:request {targetUserId}  -> ack {ok, sessionId, iceServers}
//   emit  livescreen:answer  {sessionId, sdp}
//   emit  livescreen:ice     {sessionId, candidate}
//   emit  livescreen:stop    {sessionId}
//   on    livescreen:offer / livescreen:ice / livescreen:status / livescreen:ended

const REQUEST_ERRORS = {
  not_enabled: "Live Screen is not enabled for this organization yet.",
  not_authorized: "You are not authorized to view this employee's screen.",
  consent_missing: "The employee has not yet accepted the live-screen notice.",
  agent_offline: "The employee's agent is offline.",
  bad_request: "Could not start the session.",
  server_error: "Server error starting the session.",
};
const END_REASONS = {
  stopped_by_viewer: "Session ended.",
  stopped_by_employee: "The employee ended the session.",
  viewer_disconnected: "Disconnected.",
  agent_unavailable: "The agent did not respond.",
  timeout: "The session timed out.",
  max_duration: "The session reached its maximum length.",
  superseded: "A newer session replaced this one.",
  error: "The session ended on an error.",
};

export default function LiveScreenViewer({ open, targetUserId, employeeName, onClose }) {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const sessionIdRef = useRef(null);
  const [phase, setPhase] = useState("idle"); // idle | requesting | connecting | live | ended | error
  const [message, setMessage] = useState("");

  const teardown = useCallback(
    (notifyServer) => {
      const socket = getSocket();
      const sid = sessionIdRef.current;
      if (notifyServer && sid) socket.emit("livescreen:stop", { sessionId: sid });
      sessionIdRef.current = null;
      if (pcRef.current) {
        try {
          pcRef.current.getReceivers().forEach((r) => r.track && r.track.stop());
          pcRef.current.close();
        } catch {
          /* ignore */
        }
        pcRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    },
    [],
  );

  useEffect(() => {
    if (!open) return undefined;
    const socket = getSocket();
    let cancelled = false;

    setPhase("requesting");
    setMessage("");

    const onOffer = async ({ sessionId, sdp }) => {
      if (cancelled || sessionId !== sessionIdRef.current || !pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription({ type: "offer", sdp });
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit("livescreen:answer", { sessionId, sdp: answer.sdp });
        setPhase("connecting");
      } catch (err) {
        setPhase("error");
        setMessage(`Negotiation failed: ${err.message}`);
        teardown(true);
      }
    };
    const onIce = async ({ sessionId, candidate }) => {
      if (sessionId !== sessionIdRef.current || !pcRef.current || !candidate) return;
      try {
        await pcRef.current.addIceCandidate(candidate);
      } catch {
        /* non-fatal */
      }
    };
    const onStatus = ({ sessionId, status }) => {
      if (sessionId === sessionIdRef.current && status === "live") setPhase("live");
    };
    const onEnded = ({ sessionId, reason }) => {
      if (sessionId !== sessionIdRef.current) return;
      teardown(false);
      setPhase("ended");
      setMessage(END_REASONS[reason] || "Session ended.");
    };

    socket.on("livescreen:offer", onOffer);
    socket.on("livescreen:ice", onIce);
    socket.on("livescreen:status", onStatus);
    socket.on("livescreen:ended", onEnded);

    socket.emit("livescreen:request", { targetUserId }, (ack) => {
      if (cancelled) return;
      if (!ack || !ack.ok) {
        setPhase("error");
        setMessage(REQUEST_ERRORS[ack && ack.code] || "Could not start the session.");
        return;
      }
      sessionIdRef.current = ack.sessionId;
      const pc = new RTCPeerConnection({ iceServers: ack.iceServers || [] });
      pcRef.current = pc;
      pc.addEventListener("track", (e) => {
        if (videoRef.current) videoRef.current.srcObject = e.streams[0];
      });
      pc.addEventListener("icecandidate", (e) => {
        if (e.candidate) {
          socket.emit("livescreen:ice", {
            sessionId: ack.sessionId,
            candidate: e.candidate.toJSON(),
          });
        }
      });
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "connected") setPhase("live");
        if (pc.connectionState === "failed") {
          setPhase("error");
          setMessage("Peer connection failed (check TURN configuration).");
          teardown(true);
        }
      });
      setPhase("connecting");
    });

    return () => {
      cancelled = true;
      socket.off("livescreen:offer", onOffer);
      socket.off("livescreen:ice", onIce);
      socket.off("livescreen:status", onStatus);
      socket.off("livescreen:ended", onEnded);
      teardown(true);
    };
  }, [open, targetUserId, teardown]);

  if (!open) return null;

  const statusLine =
    {
      requesting: "Requesting session…",
      connecting: "Connecting…",
      live: "Live",
      ended: message || "Session ended.",
      error: message || "Error.",
    }[phase] || "";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-hair bg-surface-1 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-hair px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                phase === "live"
                  ? "bg-emerald-500"
                  : phase === "error"
                    ? "bg-red-500"
                    : phase === "ended"
                      ? "bg-slate-400"
                      : "bg-amber-400"
              }`}
            />
            <h2 className="font-display text-sm font-semibold text-txt-primary">
              Live Screen — {employeeName || "Employee"}
            </h2>
            <span className="text-xs text-txt-muted">{statusLine}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative flex aspect-video items-center justify-center bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-contain ${phase === "live" ? "" : "opacity-0"}`}
          />
          {phase !== "live" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-txt-muted">
              {phase === "error" || phase === "ended" ? (
                <MonitorOff size={28} />
              ) : (
                <Loader2 size={28} className="animate-spin" />
              )}
              <p className="max-w-sm px-6 text-center text-xs">{statusLine}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-hair px-4 py-3 text-[11px] text-txt-muted">
          <span className="flex items-center gap-1.5">
            <Wifi size={12} /> Peer-to-peer · not recorded · the employee sees a
            "your screen is being viewed" banner
          </span>
          <button
            onClick={onClose}
            className="rounded-md border border-hair px-3 py-1.5 text-xs font-semibold text-txt-primary hover:bg-surface-2"
          >
            {phase === "live" || phase === "connecting" ? "Stop & close" : "Close"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
