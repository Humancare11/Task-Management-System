import { BADGE_TONES } from "../ui/badgeTones.js";

const STATUS_STYLES = {
  todo: BADGE_TONES.neutral,
  in_progress: BADGE_TONES.amber,
  review: BADGE_TONES.sky,
  completed: BADGE_TONES.emerald,
};

const STATUS_LABELS = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
};

export default function TaskStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.todo}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
