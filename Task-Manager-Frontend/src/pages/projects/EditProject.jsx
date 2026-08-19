import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import SectionCard from "../../components/ui/SectionCard.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import ProjectForm from "../../components/projects/ProjectForm.jsx";
import { getProject, updateProject } from "../../api/projects.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { canEditProject } from "../../config/permissions.js";

export default function EditProject() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { projectId } = useParams();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    getProject(projectId)
      .then((res) => setProject(res.data.project))
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load project.");
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (!canEditProject(user)) {
    return (
      <AppLayout title="Edit Project">
        <EmptyState
          icon={ShieldOff}
          title="You don't have permission to edit this project."
          description="Only owners, admins, and managers can edit projects."
        />
      </AppLayout>
    );
  }

  function handleSubmit(payload) {
    setSubmitting(true);
    updateProject(projectId, payload)
      .then(() => {
        toast.success("Project updated successfully.");
        navigate(`/projects/${projectId}`);
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to update project.");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <AppLayout title="Edit Project">
      <div className="space-y-6">
        <PageHeader title="Edit Project" description="Update this project's details." />

        {loading && <Spinner label="Loading project..." />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && project && (
          <SectionCard className="max-w-2xl">
            <ProjectForm
              initialValues={project}
              submitting={submitting}
              onSubmit={handleSubmit}
              submitLabel="Save Changes"
            />
          </SectionCard>
        )}
      </div>
    </AppLayout>
  );
}
