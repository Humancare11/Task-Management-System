import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import QuestionStatusBadge from "./QuestionStatusBadge.jsx";
import QuestionPriorityBadge from "./QuestionPriorityBadge.jsx";

export default function QuestionCard({ question }) {
  return (
    <Link
      to={`/questions/${question.id}`}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-primary-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-ink">{question.title}</h3>
        <QuestionPriorityBadge priority={question.priority} />
      </div>

      <p className="line-clamp-2 text-sm text-slate-500">
        {question.description || "No description provided."}
      </p>

      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <QuestionStatusBadge status={question.status} />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-500">
            {question.category?.replace("_", " ")}
          </span>
        </div>
        {typeof question.answer_count === "number" && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <MessageSquare size={13} />
            {question.answer_count}
          </span>
        )}
      </div>
    </Link>
  );
}
