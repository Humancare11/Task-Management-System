import { useEffect, useState } from "react";
import Button from "../ui/Button.jsx";
import QuestionForm from "./QuestionForm.jsx";
import { createQuestion } from "../../api/questions.js";
import { useToast } from "../../context/ToastContext.jsx";

export default function QuestionFormSidePanel({
  open,
  onClose,
  onSaved,
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  function handleSubmit(payload) {
    setSubmitting(true);
    createQuestion(payload)
      .then((res) => {
        toast.success("Question posted successfully.");
        if (onSaved) onSaved(res.data.question);
        onClose();
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to post question.");
      })
      .finally(() => setSubmitting(false));
  }

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        className={`fixed top-0 right-0 h-screen w-full sm:w-[480px] bg-surface-1 shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hair px-5 py-4">
          <h2 className="text-lg font-semibold text-txt-primary">Ask a Question</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <QuestionForm submitting={submitting} onSubmit={handleSubmit} submitLabel="Post Question" />
        </div>
      </div>
    </div>
  );
}
