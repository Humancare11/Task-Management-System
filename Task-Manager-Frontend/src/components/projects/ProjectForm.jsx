import { useState } from "react";
import Button from "../ui/Button.jsx";

const STATUS_OPTIONS = ["planned", "active", "on_hold", "completed", "archived"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const inputClass =
  "w-full rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

function toDateInputValue(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function ProjectForm({
  initialValues,
  submitting,
  onSubmit,
  onCancel,
  submitLabel,
}) {
  const [values, setValues] = useState({
    name: initialValues?.name ?? "",
    description: initialValues?.description ?? "",
    status: initialValues?.status ?? "planned",
    priority: initialValues?.priority ?? "medium",
    start_date: toDateInputValue(initialValues?.start_date),
    due_date: toDateInputValue(initialValues?.due_date),
  });
  const [error, setError] = useState("");

  function handleChange(field) {
    return (e) => setValues((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!values.name.trim()) {
      setError("Project name is required.");
      return;
    }
    setError("");
    onSubmit({
      ...values,
      name: values.name.trim(),
      start_date: values.start_date || null,
      due_date: values.due_date || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-txt-primary">Name</label>
        <input
          type="text"
          value={values.name}
          onChange={handleChange("name")}
          placeholder="Website Redesign"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-txt-primary">Description</label>
        <textarea
          value={values.description}
          onChange={handleChange("description")}
          rows={4}
          placeholder="Redesign the company website."
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-txt-primary">Status</label>
          <select value={values.status} onChange={handleChange("status")} className={inputClass}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="capitalize">
                {opt.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-txt-primary">Priority</label>
          <select value={values.priority} onChange={handleChange("priority")} className={inputClass}>
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="capitalize">
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-txt-primary">Start Date</label>
          <input
            type="date"
            value={values.start_date}
            onChange={handleChange("start_date")}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-txt-primary">Due Date</label>
          <input
            type="date"
            value={values.due_date}
            onChange={handleChange("due_date")}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
