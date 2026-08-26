const PRIORITY_STYLES = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-orange-50 text-orange-700",
  urgent: "bg-red-50 text-red-700",
};

export default function QuestionPriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium}`}
    >
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-current" />
      {priority}
    </span>
  );
}
