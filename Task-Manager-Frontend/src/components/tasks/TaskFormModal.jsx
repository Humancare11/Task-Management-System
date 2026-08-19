import { useEffect, useState } from "react";
import Modal from "../common/Modal.jsx";
import Button from "../ui/Button.jsx";
import { createTask, updateTask } from "../../api/tasks.js";
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
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      });
    } else {
      setValues(emptyValues);
    }
    setError("");
  }, [open, mode, task]);

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
    };

    setSubmitting(true);
    const request =
      mode === "edit" ? updateTask(projectId, task.id, payload) : createTask(projectId, payload);

    request
      .then(() => {
        toast.success(mode === "edit" ? "Task updated." : "Task created.");
        onSaved();
        onClose();
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to save task.");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit Task" : "Create Task"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : mode === "edit" ? "Save Changes" : "Create Task"}
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

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Title</label>
          <input
            type="text"
            value={values.title}
            onChange={handleChange("title")}
            placeholder="Create homepage"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Description</label>
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
            <label className="mb-1.5 block text-sm font-medium text-ink">Assignee</label>
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
            <label className="mb-1.5 block text-sm font-medium text-ink">Due Date</label>
            <input
              type="date"
              value={values.due_date}
              onChange={handleChange("due_date")}
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
