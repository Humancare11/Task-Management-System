const roleVariants = {
  owner: "bg-purple-50 text-purple-700",
  admin: "bg-indigo-50 text-primary-700",
  manager: "bg-blue-50 text-blue-700",
  member: "bg-slate-100 text-slate-600",
  client: "bg-amber-50 text-amber-700",
};

const toneVariants = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-sky-50 text-sky-700",
};

export default function Badge({ role, tone = "neutral", children, className = "" }) {
  const style = role ? roleVariants[role] ?? toneVariants.neutral : toneVariants[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style} ${className}`}
    >
      {children ?? role}
    </span>
  );
}
