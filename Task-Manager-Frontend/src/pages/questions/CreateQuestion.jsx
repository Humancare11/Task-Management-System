import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import AppLayout from "../../components/layout/AppLayout.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import SectionCard from "../../components/ui/SectionCard.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import QuestionForm from "../../components/questions/QuestionForm.jsx";
import { createQuestion } from "../../api/questions.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { canCreateQuestion } from "../../config/permissions.js";

export default function CreateQuestion() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  if (!canCreateQuestion(user)) {
    return (
      <AppLayout title="Ask a Question">
        <EmptyState
          icon={ShieldOff}
          title="You don't have permission to ask questions."
          description="Contact your organization admin if you believe this is a mistake."
        />
      </AppLayout>
    );
  }

  function handleSubmit(payload) {
    setSubmitting(true);
    createQuestion(payload)
      .then((res) => {
        toast.success("Question posted successfully.");
        navigate(`/questions/${res.data.question.id}`);
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to post question.");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <AppLayout title="Ask a Question">
      <div className="space-y-6">
        <PageHeader title="Ask a Question" description="Post a question for your team to answer." />
        <SectionCard className="max-w-2xl">
          <QuestionForm submitting={submitting} onSubmit={handleSubmit} submitLabel="Post Question" />
        </SectionCard>
      </div>
    </AppLayout>
  );
}
