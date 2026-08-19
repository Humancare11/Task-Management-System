const STATUS_STYLES = {
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-50 text-amber-700",
  review: "bg-sky-50 text-sky-700",
  completed: "bg-emerald-50 text-emerald-700",
};

const STATUS_LABELS = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
};

export default function TaskStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.todo}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
