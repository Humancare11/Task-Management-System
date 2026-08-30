import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import QuestionStatusBadge from "./QuestionStatusBadge.jsx";
import QuestionPriorityBadge from "./QuestionPriorityBadge.jsx";

export default function QuestionCard({ question }) {
  return (
    <Link
      to={`/questions/${question.id}`}
      className="flex flex-col gap-3 rounded-xl border border-hair bg-surface-1 p-5 transition-colors hover:border-accentblue hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-txt-primary">{question.title}</h3>
        <QuestionPriorityBadge priority={question.priority} />
      </div>

      <p className="line-clamp-2 text-sm text-txt-muted">
        {question.description || "No description provided."}
      </p>

      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <QuestionStatusBadge status={question.status} />
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium capitalize text-txt-muted">
            {question.category?.replace("_", " ")}
          </span>
        </div>
        {typeof question.answer_count === "number" && (
          <span className="flex items-center gap-1 text-xs text-txt-muted">
            <MessageSquare size={13} />
            {question.answer_count}
          </span>
        )}
      </div>
    </Link>
  );
}
