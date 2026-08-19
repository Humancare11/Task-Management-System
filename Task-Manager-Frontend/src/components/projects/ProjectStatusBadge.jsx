const STATUS_STYLES = {
  planned: "bg-slate-100 text-slate-600",
  active: "bg-emerald-50 text-emerald-700",
  on_hold: "bg-amber-50 text-amber-700",
  completed: "bg-sky-50 text-sky-700",
  archived: "bg-slate-200 text-slate-500",
};

const STATUS_LABELS = {
  planned: "Planned",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  archived: "Archived",
};

export default function ProjectStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.planned}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
