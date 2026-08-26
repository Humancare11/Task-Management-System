import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";

import AppLayout from "../../components/layout/AppLayout.jsx";
import Button from "../../components/ui/Button.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import ConfirmDialog from "../../components/common/ConfirmDialog.jsx";
import QuestionStatusBadge from "../../components/questions/QuestionStatusBadge.jsx";
import QuestionPriorityBadge from "../../components/questions/QuestionPriorityBadge.jsx";
import AttachmentPanel from "../../components/questions/AttachmentPanel.jsx";
import {
  getQuestion,
  resolveQuestion,
  listAnswers,
  createAnswer,
  updateAnswer,
  deleteAnswer,
  acceptAnswer,
  listQuestionAttachments,
  uploadQuestionAttachment,
  deleteQuestionAttachment,
  listAnswerAttachments,
  uploadAnswerAttachment,
  deleteAnswerAttachment,
  updateQuestionStatus,
} from "../../api/questions.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import {
  canUploadQuestionAttachment,
  canDeleteAttachment,
  canEditAnswer,
  canDeleteAnswer,
  canAcceptAnswer,
  canResolveQuestion,
} from "../../config/permissions.js";

function formatDateTime(value) {
  if (!value) return "--";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

export default function QuestionDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [answerAttachments, setAnswerAttachments] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [answerText, setAnswerText] = useState("");
  const [answerSending, setAnswerSending] = useState(false);
  const [editingAnswerId, setEditingAnswerId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [answerToDelete, setAnswerToDelete] = useState(null);
  const [answerDeleting, setAnswerDeleting] = useState(false);

  const [acceptingId, setAcceptingId] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [questionAttachmentUploading, setQuestionAttachmentUploading] = useState(false);
  const [answerAttachmentUploading, setAnswerAttachmentUploading] = useState({});

  function fetchAll() {
    setLoading(true);
    setError("");
    Promise.all([
      getQuestion(id),
      listAnswers(id),
      listQuestionAttachments(id),
    ])
      .then(([questionRes, answersRes, attachmentsRes]) => {
        setQuestion(questionRes.data.question);
        setAnswers(answersRes.data.answers);
        setAttachments(attachmentsRes.data.attachments);

        return Promise.all(
          answersRes.data.answers.map((answer) =>
            listAnswerAttachments(id, answer.id).then((res) => [answer.id, res.data.attachments]),
          ),
        );
      })
      .then((pairs) => {
        if (!pairs) return;
        setAnswerAttachments(Object.fromEntries(pairs));
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load question.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ─── question attachment actions ───────────────────────────────────────

  function handleQuestionAttachmentUpload(file) {
    setQuestionAttachmentUploading(true);
    uploadQuestionAttachment(id, file)
      .then((res) => {
        setAttachments((prev) => [...prev, res.data.attachment]);
        toast.success("Attachment uploaded.");
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to upload attachment.");
      })
      .finally(() => setQuestionAttachmentUploading(false));
  }

  function handleQuestionAttachmentDelete(file) {
    return deleteQuestionAttachment(id, file.id)
      .then(() => {
        setAttachments((prev) => prev.filter((a) => a.id !== file.id));
        toast.success("Attachment deleted.");
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to delete attachment.");
      });
  }

  // ─── answer attachment actions ─────────────────────────────────────────

  function handleAnswerAttachmentUpload(answerId, file) {
    setAnswerAttachmentUploading((prev) => ({ ...prev, [answerId]: true }));
    uploadAnswerAttachment(id, answerId, file)
      .then((res) => {
        setAnswerAttachments((prev) => ({
          ...prev,
          [answerId]: [...(prev[answerId] || []), res.data.attachment],
        }));
        toast.success("Attachment uploaded.");
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to upload attachment.");
      })
      .finally(() =>
        setAnswerAttachmentUploading((prev) => ({ ...prev, [answerId]: false })),
      );
  }

  function handleAnswerAttachmentDelete(answerId, file) {
    return deleteAnswerAttachment(id, answerId, file.id)
      .then(() => {
        setAnswerAttachments((prev) => ({
          ...prev,
          [answerId]: (prev[answerId] || []).filter((a) => a.id !== file.id),
        }));
        toast.success("Attachment deleted.");
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to delete attachment.");
      });
  }

  // ─── answer actions ─────────────────────────────────────────────────────

  function handleSendAnswer() {
    const content = answerText.trim();
    if (!content) return;
    setAnswerSending(true);
    createAnswer(id, content)
      .then((res) => {
        // createAnswer's response has no `author` relation (unlike listAnswers),
        // so fill it in from the current user since they're the one who just posted.
        const answer = {
          ...res.data.answer,
          author: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            avatar_url: user.avatar_url,
          },
        };
        setAnswers((prev) => [...prev, answer]);
        setAnswerAttachments((prev) => ({ ...prev, [answer.id]: [] }));
        setAnswerText("");
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to post answer.");
      })
      .finally(() => setAnswerSending(false));
  }

  function startEditingAnswer(answer) {
    setEditingAnswerId(answer.id);
    setEditingText(answer.content);
  }

  function handleSaveAnswerEdit(answerId) {
    const content = editingText.trim();
    if (!content) return;
    updateAnswer(id, answerId, content)
      .then((res) => {
        setAnswers((prev) => prev.map((a) => (a.id === answerId ? res.data.answer : a)));
        setEditingAnswerId(null);
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to update answer.");
      });
  }

  function handleConfirmDeleteAnswer() {
    if (!answerToDelete) return;
    setAnswerDeleting(true);
    deleteAnswer(id, answerToDelete.id)
      .then(() => {
        setAnswers((prev) => prev.filter((a) => a.id !== answerToDelete.id));
        toast.success("Answer deleted.");
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to delete answer.");
      })
      .finally(() => {
        setAnswerDeleting(false);
        setAnswerToDelete(null);
      });
  }

  function handleAcceptAnswer(answerId) {
    setAcceptingId(answerId);
    acceptAnswer(id, answerId)
      .then(() => {
        setAnswers((prev) =>
          prev.map((a) => ({ ...a, is_accepted: a.id === answerId })),
        );
        toast.success("Answer accepted.");
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to accept answer.");
      })
      .finally(() => setAcceptingId(null));
  }

  function handleResolveQuestion() {
    setResolving(true);
    resolveQuestion(id)
      .then((res) => {
        setQuestion(res.data.question);
        toast.success("Question resolved.");
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to resolve question.");
      })
      .finally(() => setResolving(false));
  }

  function handleStatusChange(newStatus) {
    if (newStatus === question.status) {
      setStatusDropdownOpen(false);
      return;
    }
    setUpdatingStatus(true);
    updateQuestionStatus(id, newStatus)
      .then((res) => {
        setQuestion(res.data.question);
        toast.success(`Status updated to ${newStatus.replace("_", " ")}.`);
        setStatusDropdownOpen(false);
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || "Failed to update status.");
      })
      .finally(() => setUpdatingStatus(false));
  }

  if (loading) {
    return (
      <AppLayout title="Question">
        <Spinner label="Loading question..." />
      </AppLayout>
    );
  }

  if (error || !question) {
    return (
      <AppLayout title="Question">
        <ErrorState message={error || "Question not found."} onRetry={fetchAll} />
      </AppLayout>
    );
  }

  const hasAcceptedAnswer = answers.some((a) => a.is_accepted);
  const questionCode = `#Q-${String(question.id).padStart(4, "0")}`;

  return (
    <AppLayout title="Question">
      <div className="space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <Link to="/dashboard" className="hover:text-slate-600">Dashboard</Link>
          <ChevronRight size={14} />
          <Link to="/questions" className="hover:text-slate-600">Questions</Link>
          <ChevronRight size={14} />
          <span className="text-slate-600">Question Details</span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main thread */}
          <div className="space-y-4 lg:col-span-2">
            {/* Header card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 flex justify-between items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <QuestionStatusBadge status={question.status} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-500">
                    {question.category?.replace("_", " ")}
                  </span>
                </div>
                <h1 className="mt-3 font-display text-lg font-semibold text-ink">{question.title}</h1>
                <p className="mt-1 text-xs text-slate-400">{questionCode}</p>
              </div>

              {/* Status Dropdown */}
              {canResolveQuestion(user, question) && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                    disabled={updatingStatus}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <span>Mark as</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>

                  {statusDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setStatusDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-1 z-20 w-36 origin-top-right rounded-lg border border-slate-200 bg-white p-1 shadow-lg focus:outline-none">
                        <button
                          type="button"
                          onClick={() => handleStatusChange("open")}
                          className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange("in_progress")}
                          className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          In Progress
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange("resolved")}
                          disabled={!hasAcceptedAnswer}
                          className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          title={!hasAcceptedAnswer ? "Accept an answer before resolving." : undefined}
                        >
                          Resolved
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Question message */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <HelpCircle size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">Question</span>
                    <span className="text-xs text-slate-400">{formatDateTime(question.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {question.description}
                  </p>

                  <div className="mt-3">
                    <AttachmentPanel
                      attachments={attachments}
                      onUpload={handleQuestionAttachmentUpload}
                      onDelete={handleQuestionAttachmentDelete}
                      canUpload={canUploadQuestionAttachment(user)}
                      canDelete={(file) => canDeleteAttachment(user, file)}
                      uploading={questionAttachmentUploading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Answers thread */}
            <div className="space-y-3">
              {answers.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
                  <p className="text-sm text-slate-400">No answers yet. Be the first to help.</p>
                </div>
              )}

              {answers.map((answer) => (
                <div
                  key={answer.id}
                  className={`rounded-xl border bg-white p-5 ${
                    answer.is_accepted ? "border-emerald-200" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      firstName={answer.author?.first_name}
                      lastName={answer.author?.last_name}
                      avatarUrl={answer.author?.avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink">
                            {answer.author
                              ? `${answer.author.first_name} ${answer.author.last_name}`
                              : "Unknown"}
                          </span>
                          {answer.is_accepted && (
                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                              <CheckCircle2 size={13} />
                              Accepted
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-slate-400">{formatDateTime(answer.created_at)}</span>
                          {canAcceptAnswer(user, question) && !answer.is_accepted && (
                            <button
                              type="button"
                              onClick={() => handleAcceptAnswer(answer.id)}
                              disabled={acceptingId === answer.id}
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-40"
                            >
                              {acceptingId === answer.id ? "Accepting..." : "Accept"}
                            </button>
                          )}
                          {canEditAnswer(user, answer) && editingAnswerId !== answer.id && (
                            <button
                              type="button"
                              onClick={() => startEditingAnswer(answer)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {canDeleteAnswer(user, answer) && (
                            <button
                              type="button"
                              onClick={() => setAnswerToDelete(answer)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {editingAnswerId === answer.id ? (
                        <div className="mt-2 space-y-2">
                          <textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSaveAnswerEdit(answer.id)}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={X}
                              onClick={() => setEditingAnswerId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">
                          {answer.content}
                        </p>
                      )}

                      <div className="mt-3">
                        <AttachmentPanel
                          title="Attachments"
                          attachments={answerAttachments[answer.id] || []}
                          onUpload={(file) => handleAnswerAttachmentUpload(answer.id, file)}
                          onDelete={(file) => handleAnswerAttachmentDelete(answer.id, file)}
                          canUpload={canUploadQuestionAttachment(user)}
                          canDelete={(file) => canDeleteAttachment(user, file)}
                          uploading={!!answerAttachmentUploading[answer.id]}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex gap-3">
                <Avatar
                  firstName={user?.first_name}
                  lastName={user?.last_name}
                  avatarUrl={user?.avatar_url}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    rows={3}
                    placeholder="Write a reply..."
                    className="w-full resize-none border-0 bg-transparent p-0 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-0"
                  />
                  <div className="mt-2 flex justify-end border-t border-slate-100 pt-2">
                    <Button
                      size="sm"
                      icon={Send}
                      disabled={!answerText.trim() || answerSending}
                      onClick={handleSendAnswer}
                    >
                      {answerSending ? "Posting..." : "Reply"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-1 font-display text-base font-semibold text-ink">Question Details</h2>
              <div className="divide-y divide-slate-100">
                <DetailRow label="Question ID" value={questionCode} />
                <DetailRow label="Category" value={<span className="capitalize">{question.category?.replace("_", " ")}</span>} />
                <DetailRow label="Priority" value={<QuestionPriorityBadge priority={question.priority} />} />
                <DetailRow label="Visibility" value={<span className="capitalize">{question.visibility}</span>} />
                {question.project && (
                  <DetailRow
                    label="Project"
                    value={
                      <Link to={`/projects/${question.project.id}`} className="text-primary-600 hover:text-primary-700">
                        {question.project.name}
                      </Link>
                    }
                  />
                )}
                <DetailRow label="Created" value={formatDate(question.created_at)} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 font-display text-base font-semibold text-ink">Status</h2>
              <QuestionStatusBadge status={question.status} />

              {canResolveQuestion(user, question) && question.status !== "resolved" && (
                <Button
                  className="mt-4 w-full justify-center"
                  disabled={!hasAcceptedAnswer || resolving}
                  onClick={handleResolveQuestion}
                  title={!hasAcceptedAnswer ? "Accept an answer before resolving." : undefined}
                >
                  {resolving ? "Resolving..." : "Mark as Resolved"}
                </Button>
              )}

              {question.status !== "resolved" && !hasAcceptedAnswer && canResolveQuestion(user, question) && (
                <p className="mt-2 text-xs text-slate-400">
                  Accept an answer before resolving this question.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!answerToDelete}
        onClose={() => setAnswerToDelete(null)}
        onConfirm={handleConfirmDeleteAnswer}
        title="Delete answer"
        description="Delete this answer? This cannot be undone."
        confirmLabel="Delete"
        loading={answerDeleting}
      />
    </AppLayout>
  );
}
