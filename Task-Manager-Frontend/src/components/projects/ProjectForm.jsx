import { useState } from "react";
import Button from "../ui/Button.jsx";

const STATUS_OPTIONS = ["planned", "active", "on_hold", "completed", "archived"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";

function toDateInputValue(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function ProjectForm({ initialValues, submitting, onSubmit, submitLabel }) {
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
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Name</label>
        <input
          type="text"
          value={values.name}
          onChange={handleChange("name")}
          placeholder="Website Redesign"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink">Description</label>
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
          <label className="mb-1.5 block text-sm font-medium text-ink">Status</label>
          <select value={values.status} onChange={handleChange("status")} className={inputClass}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="capitalize">
                {opt.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Priority</label>
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
          <label className="mb-1.5 block text-sm font-medium text-ink">Start Date</label>
          <input
            type="date"
            value={values.start_date}
            onChange={handleChange("start_date")}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Due Date</label>
          <input
            type="date"
            value={values.due_date}
            onChange={handleChange("due_date")}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
