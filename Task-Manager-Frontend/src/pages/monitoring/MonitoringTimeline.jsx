import { useMemo, useState } from "react";
import { formatClock, formatHm, INTERVAL_META, SCREEN_OFF_REASON_LABEL } from "./monitoringUtils.js";

// One horizontal chronological band for a device-day: the classified
// active / idle / screen_off / untracked partition, with hour ticks and a
// hover tooltip. Scrolls inside its own container on narrow screens.
export default function MonitoringTimeline({ pcSession, intervals }) {
  const [hover, setHover] = useState(null);

  const model = useMemo(() => {
    if (!pcSession) return null;
    const start = new Date(pcSession.first_pc_on).getTime();
    const end = new Date(pcSession.final_pc_off).getTime();
    const span = Math.max(end - start, 1);

    const segments = (intervals || []).map((iv) => {
      const s = new Date(iv.started_at).getTime();
      const e = new Date(iv.ended_at).getTime();
      return {
        type: iv.type,
        reason: iv.screen_off_reason || null,
        left: ((s - start) / span) * 100,
        width: Math.max(((e - s) / span) * 100, 0.15),
        startMs: s,
        endMs: e,
        seconds: iv.duration_seconds,
      };
    });

    // hour ticks
    const ticks = [];
    const firstHour = new Date(start);
    firstHour.setMinutes(0, 0, 0);
    if (firstHour.getTime() < start) firstHour.setHours(firstHour.getHours() + 1);
    for (let t = firstHour.getTime(); t < end; t += 3600 * 1000) {
      ticks.push({ left: ((t - start) / span) * 100, label: formatClock(new Date(t)) });
    }

    return { start, end, segments, ticks };
  }, [pcSession, intervals]);

  if (!model) return null;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* band */}
        <div
          className="relative h-9 w-full overflow-hidden rounded-lg border border-hair bg-surface-2"
          onMouseLeave={() => setHover(null)}
        >
          {model.segments.map((seg, i) => (
            <div
              key={i}
              className={`absolute top-0 h-full ${INTERVAL_META[seg.type]?.cls || "bg-slate-300"} ${
                seg.type === "active" ? "opacity-90" : "opacity-80"
              } transition-opacity hover:opacity-100`}
              style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
              onMouseEnter={() =>
                setHover({
                  type: seg.type,
                  reason: seg.reason,
                  text: `${formatClock(new Date(seg.startMs))} – ${formatClock(
                    new Date(seg.endMs),
                  )} · ${formatHm(seg.seconds)}`,
                })
              }
            />
          ))}
          {model.ticks.map((tick, i) => (
            <div
              key={`t${i}`}
              className="absolute top-0 h-full w-px bg-black/10 dark:bg-white/10"
              style={{ left: `${tick.left}%` }}
            />
          ))}
        </div>

        {/* hour labels */}
        <div className="relative mt-1 h-4">
          {model.ticks.map((tick, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 text-[10px] text-txt-muted"
              style={{ left: `${tick.left}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>

        {/* hover detail */}
        <div className="mt-2 h-5 text-xs text-txt-muted">
          {hover ? (
            <span>
              <span
                className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${
                  INTERVAL_META[hover.type]?.cls || "bg-slate-300"
                }`}
              />
              {INTERVAL_META[hover.type]?.label || hover.type}
              {hover.reason ? ` (${SCREEN_OFF_REASON_LABEL[hover.reason] || hover.reason})` : ""} ·{" "}
              {hover.text}
            </span>
          ) : (
            <span className="opacity-70">Hover the timeline for details</span>
          )}
        </div>

        {/* legend */}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-txt-muted">
          {Object.entries(INTERVAL_META).map(([key, meta]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${meta.cls}`} />
              {meta.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
