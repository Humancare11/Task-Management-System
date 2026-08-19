import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import SectionCard from "../../components/ui/SectionCard.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ProjectForm from "../../components/projects/ProjectForm.jsx";
import { createProject } from "../../api/projects.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { canCreateProject } from "../../config/permissions.js";

export default function CreateProject() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  if (!canCreateProject(user)) {
    return (
      <AppLayout title="Create Project">
        <EmptyState
          icon={ShieldOff}
          title="You don't have permission to create projects."
          description="Only owners, admins, and managers can create new projects."
        />
      </AppLayout>
    );
  }

  function handleSubmit(payload) {
    setSubmitting(true);
    createProject(payload)
      .then((res) => {
        toast.success("Project created successfully.");
        navigate(`/projects/${res.data.project.id}`);
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to create project.");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <AppLayout title="Create Project">
      <div className="space-y-6">
        <PageHeader title="Create Project" description="Set up a new project for your team." />
        <SectionCard className="max-w-2xl">
          <ProjectForm submitting={submitting} onSubmit={handleSubmit} submitLabel="Create Project" />
        </SectionCard>
      </div>
    </AppLayout>
  );
}
