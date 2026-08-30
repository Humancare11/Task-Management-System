import { useEffect, useState } from "react";
// Drawer presentation replaces the old modal while preserving the existing
// Create/Edit Subtask form submission logic, API calls and validation.
import Drawer from "../ui/Drawer.jsx";
import Button from "../ui/Button.jsx";
import { createSubtask, updateSubtask } from "../../api/subtasks.js";
import { useToast } from "../../context/ToastContext.jsx";

const STATUS_OPTIONS = ["todo", "in_progress", "completed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const inputClass =
  "w-full rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue disabled:cursor-not-allowed disabled:bg-surface-2";

const labelClass = "mb-1.5 block text-sm font-medium text-txt-primary";

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
  parentTaskTitle,
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
        // Keep the drawer (and entered data) open on failure.
        toast.error(err.response?.data?.message || "Failed to save subtask.");
        setError(err.response?.data?.message || "Failed to save subtask.");
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  const isEdit = mode === "edit";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Subtask" : "Create Subtask"}
      description={
        isEdit
          ? "Update the details of this subtask."
          : "Add a new subtask to this task."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? isEdit
                ? "Saving..."
                : "Creating..."
              : isEdit
                ? "Save Changes"
                : "Create Subtask"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {parentTaskTitle && (
          <div>
            <span className={labelClass}>Parent Task</span>
            <div className="rounded-lg border border-hair bg-surface-2 px-3 py-2 text-sm text-txt-muted">
              {parentTaskTitle}
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <label className={labelClass}>Title</label>
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
          <label className={labelClass}>Description</label>
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
            <label className={labelClass}>Status</label>
            <select
              value={values.status}
              onChange={handleChange("status")}
              className={`${inputClass} capitalize`}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Priority</label>
            <select
              value={values.priority}
              onChange={handleChange("priority")}
              className={`${inputClass} capitalize`}
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
            <label className={labelClass}>Assignee</label>
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
            <label className={labelClass}>Due Date</label>
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
          <label className={labelClass}>Tags</label>
          <div className="flex min-h-[38px] flex-wrap gap-1.5 rounded-lg border border-hair bg-surface-1 px-3 py-2 focus-within:border-accentblue focus-within:ring-1 focus-within:ring-accentblue">
            {values.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 text-sky-500 hover:text-sky-700 dark:hover:text-sky-200"
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
              className="min-w-[120px] flex-1 bg-transparent text-sm text-txt-primary placeholder:text-txt-muted outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-txt-muted">
            Press Enter or comma to add a tag
          </p>
        </div>
      </div>
    </Drawer>
  );
}
