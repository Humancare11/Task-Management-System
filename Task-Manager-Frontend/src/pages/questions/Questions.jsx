import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eye,
  HelpCircle,
  Layers,
  Plus,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../../components/layout/AppLayout.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import Spinner from "../../components/common/Spinner.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Button from "../../components/ui/Button.jsx";
import SearchInput from "../../components/ui/SearchInput.jsx";
import QuestionStatusBadge from "../../components/questions/QuestionStatusBadge.jsx";
import QuestionPriorityBadge from "../../components/questions/QuestionPriorityBadge.jsx";
import QuestionFormSidePanel from "../../components/questions/QuestionFormSidePanel.jsx";
import { listQuestions } from "../../api/questions.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canCreateQuestion } from "../../config/permissions.js";

const STATUS_OPTIONS = ["open", "resolved"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"];
const CATEGORY_OPTIONS = [
  "technical",
  "bug",
  "task_related",
  "project",
  "account",
  "general",
  "other",
];

const PAGE_SIZE = 10;

const selectClass =
  "rounded-lg border border-hair bg-surface-1 px-3 py-2 text-sm text-txt-primary focus:border-accentblue focus:outline-none focus:ring-1 focus:ring-accentblue";

function formatDate(value) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatCard({ icon: Icon, tone, value, label }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-hair bg-surface-1 p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-txt-primary">{value}</p>
        <p className="text-xs text-txt-muted">{label}</p>
      </div>
    </div>
  );
}

export default function Questions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

  function fetchQuestions() {
    setLoading(true);
    setError("");
    listQuestions()
      .then((res) => setQuestions(res.data.questions))
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load questions.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchQuestions();
  }, []);

  const stats = useMemo(() => {
    return {
      total: questions.length,
      open: questions.filter((q) => q.status === "open").length,
      resolved: questions.filter((q) => q.status === "resolved").length,
      highPriority: questions.filter((q) => q.priority === "high" || q.priority === "urgent").length,
    };
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter((question) => {
      if (statusFilter !== "all" && question.status !== statusFilter) return false;
      if (priorityFilter !== "all" && question.priority !== priorityFilter) return false;
      if (categoryFilter !== "all" && question.category !== categoryFilter) return false;
      if (!query) return true;
      return (
        question.title?.toLowerCase().includes(query) ||
        question.description?.toLowerCase().includes(query)
      );
    });
  }, [questions, search, statusFilter, priorityFilter, categoryFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, priorityFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedQuestions = filteredQuestions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <AppLayout title="Questions">
      <div className="space-y-6">
        <PageHeader
          title="Questions"
          description="Ask and answer questions with your team."
          actions={
            canCreateQuestion(user) && (
              <Button icon={Plus} onClick={() => setIsSidePanelOpen(true)}>
                Ask a Question
              </Button>
            )
          }
        />

        {loading && <Spinner label="Loading questions..." />}

        {!loading && error && <ErrorState message={error} onRetry={fetchQuestions} />}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Layers} tone="bg-accentblue-soft text-accentblue" value={stats.total} label="Total Questions" />
              <StatCard icon={Circle} tone="bg-sky-500/15 text-sky-600 dark:text-sky-300" value={stats.open} label="Open" />
              <StatCard icon={CheckCircle2} tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" value={stats.resolved} label="Resolved" />
              <StatCard icon={AlertTriangle} tone="bg-amber-500/15 text-amber-600 dark:text-amber-300" value={stats.highPriority} label="High Priority" />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions..."
                className="sm:max-w-xs"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="capitalize">
                    {opt}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All priorities</option>
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="capitalize">
                    {opt}
                  </option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All categories</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="capitalize">
                    {opt.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            {filteredQuestions.length === 0 ? (
              <EmptyState
                icon={HelpCircle}
                title={questions.length === 0 ? "No questions yet" : "No questions found"}
                description={
                  questions.length === 0
                    ? "Ask your first question to get help from your team."
                    : "Try adjusting your filters, or ask a new question."
                }
                action={
                  canCreateQuestion(user) && (
                    <Button icon={Plus} onClick={() => setIsSidePanelOpen(true)}>
                      Ask a Question
                    </Button>
                  )
                }
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-hair bg-surface-1">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-hair bg-surface-2">
                      <tr>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Question ID</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Title</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Category</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Priority</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Created</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">Status</th>
                        <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-txt-muted">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-hair">
                      {pagedQuestions.map((question) => (
                        <tr key={question.id} className="hover:bg-surface-2">
                          <td className="px-6 py-4 text-sm font-medium text-accentblue">
                            <Link to={`/questions/${question.id}`}>
                              #Q-{String(question.id).padStart(4, "0")}
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <Link
                              to={`/questions/${question.id}`}
                              className="text-sm font-medium text-txt-primary hover:text-accentblue"
                            >
                              {question.title}
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium capitalize text-txt-muted">
                              {question.category?.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <QuestionPriorityBadge priority={question.priority} />
                          </td>
                          <td className="px-6 py-4 text-sm text-txt-muted">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar size={13} className="text-txt-muted" />
                              {formatDate(question.created_at)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <QuestionStatusBadge status={question.status} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => navigate(`/questions/${question.id}`)}
                              className="rounded-md p-1.5 text-txt-muted hover:bg-surface-2 hover:text-txt-primary"
                              title="View question"
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-hair px-6 py-3">
                  <p className="text-xs text-txt-muted">
                    Showing {pagedQuestions.length} of {filteredQuestions.length} questions
                  </p>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="rounded-md p-1.5 text-txt-muted hover:bg-surface-2 disabled:opacity-30"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPage(n)}
                          className={`h-7 w-7 rounded-md text-xs font-medium ${
                            n === currentPage
                              ? "bg-accentblue text-white"
                              : "text-txt-muted hover:bg-surface-2"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="rounded-md p-1.5 text-txt-muted hover:bg-surface-2 disabled:opacity-30"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <QuestionFormSidePanel
        open={isSidePanelOpen}
        onClose={() => setIsSidePanelOpen(false)}
        onSaved={fetchQuestions}
      />
    </AppLayout>
  );
}
