import { ListChecks, Circle, Loader, CalendarClock, AlertTriangle } from "lucide-react";

function Tile({ icon: Icon, label, hint, value, tone }) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-txt-primary";
  return (
    <div className="rounded-xl border border-hair bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-txt-muted">
        <Icon size={15} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">
          {label}
        </span>
      </div>
      <p className={`mt-2 text-2xl font-display font-bold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-txt-muted">{hint}</p>
    </div>
  );
}

export default function MyTasksSummary({ summary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Tile icon={ListChecks} label="My Tasks" value={summary.total} hint="Total assigned to you" />
      <Tile icon={Circle} label="To Do" value={summary.todo} hint="Waiting to be started" />
      <Tile icon={Loader} label="In Progress" value={summary.in_progress} hint="Currently being worked on" />
      <Tile
        icon={CalendarClock}
        label="Due Soon"
        value={summary.dueSoon}
        hint="Approaching their due date"
        tone={summary.dueSoon > 0 ? "warning" : undefined}
      />
      <Tile
        icon={AlertTriangle}
        label="Overdue"
        value={summary.overdue}
        hint="Past their due date"
        tone={summary.overdue > 0 ? "danger" : undefined}
      />
    </div>
  );
}
