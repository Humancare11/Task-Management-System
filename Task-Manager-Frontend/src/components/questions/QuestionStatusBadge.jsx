const STATUS_STYLES = {
  open: "bg-sky-50 text-sky-700",
  resolved: "bg-emerald-50 text-emerald-700",
};

const STATUS_LABELS = {
  open: "Open",
  resolved: "Resolved",
};

export default function QuestionStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.open}`}
    >
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
