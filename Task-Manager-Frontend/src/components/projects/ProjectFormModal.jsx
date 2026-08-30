import { useEffect, useState } from "react";
import { X } from "lucide-react";
import ProjectForm from "./ProjectForm.jsx";
import ErrorState from "../common/ErrorState.jsx";
import Spinner from "../common/Spinner.jsx";
import { createProject, getProject, updateProject } from "../../api/projects.js";
import { useToast } from "../../context/ToastContext.jsx";

/**
 * Right-side drawer for creating / editing a project — mirrors the Create Task
 * drawer (TaskFormModal): 480px width, backdrop, 300ms slide transition, Esc to
 * close, scrollable body. Reuses the existing <ProjectForm> and the existing
 * createProject / getProject / updateProject APIs. No new business logic.
 */
export default function ProjectFormModal({
  open,
  onClose,
  onSaved,
  mode = "create",
  project,
}) {
  const toast = useToast();
  const isEdit = mode === "edit";
  const projectId = project?.id;

  const [submitting, setSubmitting] = useState(false);
  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(false);

  const [loadingProject, setLoadingProject] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [projectData, setProjectData] = useState(null);

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
    if (!open) return undefined;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Edit mode: load the project's current data (same call as the Edit Project page).
  useEffect(() => {
    if (!open || !isEdit || !projectId) return undefined;
    let active = true;
    setLoadingProject(true);
    setLoadError("");
    setProjectData(null);
    getProject(projectId)
      .then((res) => {
        if (active) setProjectData(res.data.project);
      })
      .catch((err) => {
        if (active) {
          setLoadError(err.response?.data?.message || "Failed to load project.");
        }
      })
      .finally(() => {
        if (active) setLoadingProject(false);
      });
    return () => {
      active = false;
    };
  }, [open, isEdit, projectId]);

  function handleSubmit(payload) {
    setSubmitting(true);
    const request = isEdit
      ? updateProject(projectId, payload)
      : createProject(payload);
    request
      .then((res) => {
        toast.success(
          isEdit
            ? "Project updated successfully."
            : "Project created successfully.",
        );
        onSaved?.(res.data.project);
        onClose();
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message ||
            (isEdit ? "Failed to update project." : "Failed to create project."),
        );
      })
      .finally(() => setSubmitting(false));
  }

  if (!shouldRender) return null;

  const title = isEdit ? "Edit Project" : "Add New Project";
  const submitLabel = isEdit ? "Save Changes" : "Create Project";
  const formReady = !isEdit || (!loadingProject && !loadError && projectData);

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed right-0 top-0 flex h-screen w-full flex-col bg-surface-1 shadow-xl transition-transform duration-300 ease-in-out sm:w-[480px] ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hair px-5 py-4">
          <h2 className="text-lg font-semibold text-txt-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isEdit && loadingProject && <Spinner label="Loading project..." />}
          {isEdit && !loadingProject && loadError && (
            <ErrorState message={loadError} />
          )}
          {formReady && (
            <ProjectForm
              key={isEdit ? `edit-${projectId}` : "create"}
              initialValues={isEdit ? projectData : undefined}
              submitting={submitting}
              onSubmit={handleSubmit}
              onCancel={onClose}
              submitLabel={submitLabel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
