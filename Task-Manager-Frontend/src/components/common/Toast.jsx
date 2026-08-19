import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const toneStyles = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  error: "bg-red-50 text-red-700 border-red-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
};

const toneIcons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export default function Toast({ message, type = "info", onDismiss }) {
  const Icon = toneIcons[type] ?? Info;

  return (
    <div
      role="alert"
      className={`flex w-80 items-start gap-2 rounded-lg border px-4 py-3 shadow-lg ${toneStyles[type] ?? toneStyles.info}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
