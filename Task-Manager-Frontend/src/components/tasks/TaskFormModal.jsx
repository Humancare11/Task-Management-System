import { useEffect, useRef, useState } from "react";
import { Paperclip, UploadCloud, X } from "lucide-react";
// Drawer presentation (shared right-side drawer) replaces the old hand-rolled
// modal shell while preserving the existing Create/Edit Task form submission
// logic, attachment upload flow, API calls and validation.
import Drawer from "../ui/Drawer.jsx";
import Button from "../ui/Button.jsx";
import { createTask, updateTask } from "../../api/tasks.js";
import { uploadAttachment } from "../../api/attachments.js";
import { useToast } from "../../context/ToastContext.jsx";

const STATUS_OPTIONS = ["todo", "in_progress", "review", "completed"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];

const inputClass =
  "w-full rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue disabled:cursor-not-allowed disabled:bg-surface-2";

const labelClass = "mb-1.5 block text-sm font-medium text-txt-primary";

function toDateInputValue(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export default function TaskFormModal({
  open,
  onClose,
  projectId,
  mode = "create",
  task,
  projectMembers = [],
  onSaved,
}) {
  const toast = useToast();
  const [values, setValues] = useState(emptyValues);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const isEdit = mode === "edit";

  useEffect(() => {
    if (!open) return;
    if (isEdit && task) {
      setValues({
        title: task.title ?? "",
        description: task.description ?? "",
        status: task.status ?? "todo",
        priority: task.priority ?? "medium",
        assigned_to: task.assigned_to ?? "",
        due_date: toDateInputValue(task.due_date),
        tags: Array.isArray(task.tags) ? task.tags.map((t) => t.name) : [],
      });
    } else {
      setValues(emptyValues);
    }
    setTagInput("");
    setError("");
    setPendingFiles([]);
  }, [open, isEdit, task]);

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
      setValues((prev) => ({ ...prev, tags: prev.tags.slice(0, -1) }));
    }
  }

  function removeTag(tag) {
    setValues((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  }

  function handleFilePick(e) {
    const files = Array.from(e.target.files);
    setPendingFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  }

  function handleFileDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    setPendingFiles((prev) => [...prev, ...files]);
  }

  function removePendingFile(index) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleChange(field) {
    return (e) => setValues((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleSubmit() {
    if (!values.title.trim()) {
      setError("Task title is required.");
      return;
    }
    setError("");

    const payload = {
      ...values,
      title: values.title.trim(),
      assigned_to: values.assigned_to ? Number(values.assigned_to) : null,
      due_date: values.due_date || null,
      tags: values.tags,
    };

    setSubmitting(true);

    if (isEdit) {
      updateTask(projectId, task.id, payload)
        .then(() => {
          toast.success("Task updated.");
          onSaved();
          onClose();
        })
        .catch((err) => {
          const msg = err.response?.data?.message || "Failed to save task.";
          toast.error(msg);
          setError(msg);
        })
        .finally(() => setSubmitting(false));
      return;
    }

    // Create mode — create task first, then upload files
    createTask(projectId, payload)
      .then(async (res) => {
        const newTaskId = res.data.task.id;

        if (pendingFiles.length > 0) {
          for (const file of pendingFiles) {
            try {
              await uploadAttachment(projectId, newTaskId, file);
            } catch {
              toast.error(`Failed to upload ${file.name}`);
            }
          }
        }

        toast.success("Task created.");
        onSaved();
        onClose();
      })
      .catch((err) => {
        const msg = err.response?.data?.message || "Failed to create task.";
        toast.error(msg);
        setError(msg);
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Task" : "Add New Task"}
      description={
        isEdit
          ? "Update the details of this task."
          : "Add a new task to this project."
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
                : "Create Task"}
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

        {/* Title */}
        <div>
          <label className={labelClass}>Title</label>
          <input
            type="text"
            value={values.title}
            onChange={handleChange("title")}
            placeholder="Create homepage"
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
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.replace("_", " ")}
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
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
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

        {/* Attachments */}
        <div>
          <label className={labelClass}>Attachments</label>

          {pendingFiles.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {pendingFiles.map((file, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-hair bg-surface-1 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-txt-muted">
                      <Paperclip size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-txt-primary">
                        {file.name}
                      </p>
                      <p className="text-xs text-txt-muted">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePendingFile(index)}
                    className="ml-2 shrink-0 rounded p-1 text-txt-muted hover:bg-surface-2 hover:text-red-500"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            className={`flex w-full flex-col items-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
              dragOver
                ? "border-accentblue bg-accentblue-soft"
                : "border-hair hover:border-accentblue/50 hover:bg-surface-2"
            }`}
          >
            <UploadCloud
              size={20}
              className={dragOver ? "text-accentblue" : "text-txt-muted"}
            />
            <span className="mt-1.5 text-xs text-txt-muted">
              Drop files here or click to upload
            </span>
            <span className="mt-0.5 text-[11px] text-txt-muted">
              PNG, JPG, PDF, DOC, XLS up to 10MB
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilePick}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          />
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
              {projectMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user?.first_name} {m.user?.last_name}
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
      </div>
    </Drawer>
  );
}
