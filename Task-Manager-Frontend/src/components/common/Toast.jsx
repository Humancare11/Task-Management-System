import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const toneStyles = {
  success:
    "bg-surface-1 border-hair text-emerald-600 dark:text-emerald-400",
  error: "bg-surface-1 border-hair text-red-600 dark:text-red-400",
  info: "bg-surface-1 border-hair text-accentblue",
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
      <p className="flex-1 text-sm font-medium text-txt-primary">{message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 text-txt-muted opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
