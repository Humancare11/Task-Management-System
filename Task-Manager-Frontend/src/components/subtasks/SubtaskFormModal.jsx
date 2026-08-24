import { useEffect, useState } from "react";
import Modal from "../common/Modal.jsx";
import Button from "../ui/Button.jsx";
import { createSubtask, updateSubtask } from "../../api/subtasks.js";
import { useToast } from "../../context/ToastContext.jsx";

const STATUS_OPTIONS = ["todo", "in_progress", "completed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";

function toDateInputValue(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

const emptyValues = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  assigned_to: "",
  due_date: "",
  tags: [],
};

export default function SubtaskFormModal({
  open,
  onClose,
  projectId,
  taskId,
  mode = "create",
  subtask,
  projectMembers = [],
  onSaved,
}) {
  const toast = useToast();

  const [values, setValues] = useState(emptyValues);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && subtask) {
      setValues({
        title: subtask.title ?? "",
        description: subtask.description ?? "",
        status: subtask.status ?? "todo",
        priority: subtask.priority ?? "medium",
        assigned_to: subtask.assigned_to ?? "",
        due_date: toDateInputValue(subtask.due_date),
        tags: Array.isArray(subtask.tags) ? subtask.tags.map((t) => t.name) : [],
      });
    } else {
      setValues(emptyValues);
    }

    setTagInput("");
    setError("");
  }, [open, mode, subtask]);

  function handleTagKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase();
      if (tag && !values.tags.includes(tag)) {
        setValues((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
      }
      setTagInput("");
    }
    if (e.key === "Backspace" && !tagInput && values.tags.length > 0) {
      setValues((prev) => ({
        ...prev,
        tags: prev.tags.slice(0, -1),
      }));
    }
  }

  function removeTag(tag) {
    setValues((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  }

  function handleChange(field) {
    return (e) => {
      setValues((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
    };
  }

  function handleSubmit() {
    if (!values.title.trim()) {
      setError("Subtask title is required.");
      return;
    }

    setError("");

    const payload = {
      title: values.title.trim(),
      description: values.description || null,
      status: values.status,
      priority: values.priority,
      assigned_to: values.assigned_to ? Number(values.assigned_to) : null,
      due_date: values.due_date || null,
      tags: values.tags,
    };

    setSubmitting(true);

    const request =
      mode === "edit"
        ? updateSubtask(projectId, taskId, subtask.id, payload)
        : createSubtask(projectId, taskId, payload);

    request
      .then(() => {
        toast.success(
          mode === "edit" ? "Subtask updated." : "Subtask created.",
        );

        onSaved();
        onClose();
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to save subtask.");
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit Subtask" : "Create Subtask"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? "Saving..."
              : mode === "edit"
                ? "Save Changes"
                : "Create Subtask"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Title
          </label>

          <input
            type="text"
            value={values.title}
            onChange={handleChange("title")}
            placeholder="Create consultation API"
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Description
          </label>

          <textarea
            value={values.description}
            onChange={handleChange("description")}
            rows={3}
            placeholder="Describe what needs to be done."
            className={inputClass}
          />
        </div>

        {/* Status + Priority */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Status
            </label>

            <select
              value={values.status}
              onChange={handleChange("status")}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Priority
            </label>

            <select
              value={values.priority}
              onChange={handleChange("priority")}
              className={inputClass}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Assignee + Due Date */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Assignee
            </label>

            <select
              value={values.assigned_to}
              onChange={handleChange("assigned_to")}
              className={inputClass}
            >
              <option value="">Unassigned</option>

              {projectMembers.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.user?.first_name} {member.user?.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Due Date
            </label>

            <input
              type="date"
              value={values.due_date}
              onChange={handleChange("due_date")}
              className={inputClass}
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">
            Tags
          </label>
          <div className="flex min-h-[38px] flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500">
            {values.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-600"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 text-sky-400 hover:text-sky-700"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder={
                values.tags.length === 0 ? "Type and press Enter…" : ""
              }
              className="min-w-[120px] flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Press Enter or comma to add a tag
          </p>
        </div>
      </div>
    </Modal>
  );
}
