import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export default function Modal({ open, onClose, title, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`relative w-full ${sizes[size] ?? sizes.md} rounded-xl border border-hair bg-surface-1 p-6 shadow-xl`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-txt-primary">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div>{children}</div>

        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
