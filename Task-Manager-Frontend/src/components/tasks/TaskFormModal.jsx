import { useEffect, useState } from "react";
import Button from "../ui/Button.jsx";
import { useRef } from "react";
import { createTask, updateTask } from "../../api/tasks.js";
import { uploadAttachment } from "../../api/attachments.js";
import { useToast } from "../../context/ToastContext.jsx";

const STATUS_OPTIONS = ["todo", "in_progress", "review", "completed"];
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

export default function TaskFormModal({
  open,
  onClose,
  projectId,
  mode = "create",
  task,
  projectMembers,
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
  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && task) {
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
    setError("");
    setPendingFiles([]);
  }, [open, mode, task]);

  useEffect(() => {
    let timer;
    if (open) {
      setShouldRender(true);
      timer = setTimeout(() => setVisible(true), 10);
    } else {
      setVisible(false);
      timer = setTimeout(() => setShouldRender(false), 300);
    }
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

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

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

    if (mode === "edit") {
      updateTask(projectId, task.id, payload)
        .then(() => {
          toast.success("Task updated.");
          onSaved();
          onClose();
        })
        .catch((err) =>
          toast.error(err.response?.data?.message || "Failed to save task."),
        )
        .finally(() => setSubmitting(false));
      return;
    }

    // Create mode — create task first, then upload files
    createTask(projectId, payload)
      .then(async (res) => {
        const newTaskId = res.data.task.id;

        // Upload all pending files sequentially
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
      .catch((err) =>
        toast.error(err.response?.data?.message || "Failed to create task."),
      )
      .finally(() => setSubmitting(false));
  }

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 h-screen w-full sm:w-[480px] bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-ink">
            {mode === "edit" ? "Edit Task" : "Add New Task"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Title
              </label>
              <input
                type="text"
                value={values.title}
                onChange={handleChange("title")}
                placeholder="Create homepage"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Description
              </label>
              <textarea
                value={values.description}
                onChange={handleChange("description")}
                rows={3}
                placeholder="Build the new homepage."
                className={inputClass}
              />
            </div>

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
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="capitalize">
                      {opt.replace("_", " ")}
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
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="capitalize">
                      {opt}
                    </option>
                  ))}
                </select>
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

            {/* Attachments */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">
                Attachments
              </label>

              {/* Pending file list */}
              {pendingFiles.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {pendingFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-slate-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                            />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-700">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePendingFile(index)}
                        className="ml-2 shrink-0 text-slate-300 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Drag & drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
                  dragOver
                    ? "border-sky-400 bg-sky-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`mx-auto mb-1 h-5 w-5 ${dragOver ? "text-sky-400" : "text-slate-300"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <p className="text-xs text-slate-400">
                  Drop files here or click to upload
                </p>
                <p className="mt-0.5 text-xs text-slate-300">
                  PNG, JPG, PDF, DOC, XLS up to 10MB
                </p>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilePick}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
            </div>

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
                  {projectMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user?.first_name} {m.user?.last_name}
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
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? "Saving..."
              : mode === "edit"
                ? "Save Changes"
                : "Create Task"}
          </Button>
        </div>
      </div>
    </div>
  );
}
