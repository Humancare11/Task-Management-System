import { useState, useEffect } from "react";
import Button from "../ui/Button.jsx";
import { listProjects } from "../../api/projects.js";
import { listProjectMembers } from "../../api/projectMembers.js";

const CATEGORY_OPTIONS = [
  "technical",
  "bug",
  "task_related",
  "project",
  "account",
  "general",
  "other",
];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];
const VISIBILITY_OPTIONS = ["organization", "project", "private"];

const inputClass =
  "w-full rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

export default function QuestionForm({ submitting, onSubmit, submitLabel }) {
  const [values, setValues] = useState({
    title: "",
    description: "",
    category: "general",
    priority: "medium",
    visibility: "organization",
    project_id: "",
    assigned_to: "",
  });

  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoadingProjects(true);
    listProjects()
      .then((res) => {
        setProjects(res.data.projects || []);
      })
      .catch((err) => {
        console.error("Failed to load projects", err);
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!values.project_id) {
      setMembers([]);
      setValues((prev) => ({ ...prev, assigned_to: "" }));
      return;
    }
    setLoadingMembers(true);
    listProjectMembers(values.project_id)
      .then((res) => {
        setMembers(res.data.members || []);
      })
      .catch((err) => {
        console.error("Failed to load project members", err);
      })
      .finally(() => setLoadingMembers(false));
  }, [values.project_id]);

  function handleChange(field) {
    return (e) => setValues((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!values.title.trim()) {
      setError("Question title is required.");
      return;
    }
    if (!values.description.trim()) {
      setError("Question description is required.");
      return;
    }
    setError("");
    onSubmit({
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
      project_id: values.project_id ? Number(values.project_id) : null,
      assigned_to: values.assigned_to ? Number(values.assigned_to) : null,
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
        <label className="mb-1.5 block text-sm font-medium text-txt-primary">Title</label>
        <input
          type="text"
          value={values.title}
          onChange={handleChange("title")}
          placeholder="How do I configure the consultation API?"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-txt-primary">Description</label>
        <textarea
          value={values.description}
          onChange={handleChange("description")}
          rows={5}
          placeholder="Describe your question in detail."
          className={inputClass}
        />
      </div>

      {/* Project and Assignee Selection */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-txt-primary">Project (Optional)</label>
          <select
            value={values.project_id}
            onChange={handleChange("project_id")}
            className={inputClass}
            disabled={loadingProjects}
          >
            <option value="">No Project</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-txt-primary">Assignee (Optional)</label>
          <select
            value={values.assigned_to}
            onChange={handleChange("assigned_to")}
            className={inputClass}
            disabled={!values.project_id || loadingMembers}
          >
            <option value="">
              {!values.project_id ? "Select a project first" : "Unassigned"}
            </option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.user?.first_name} {m.user?.last_name} {m.role ? `(${m.role})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-txt-primary">Category</label>
          <select value={values.category} onChange={handleChange("category")} className={inputClass}>
            {CATEGORY_OPTIONS.map((opt) => (
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

        <div>
          <label className="mb-1.5 block text-sm font-medium text-txt-primary">Visibility</label>
          <select value={values.visibility} onChange={handleChange("visibility")} className={inputClass}>
            {VISIBILITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="capitalize">
                {opt}
              </option>
            ))}
          </select>
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
