import { BADGE_TONES } from "../ui/badgeTones.js";

const STATUS_STYLES = {
  planned: BADGE_TONES.neutral,
  active: BADGE_TONES.emerald,
  on_hold: BADGE_TONES.amber,
  completed: BADGE_TONES.sky,
  archived: BADGE_TONES.neutral,
};

const STATUS_LABELS = {
  planned: "Planned",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  archived: "Archived",
};

export default function ProjectStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.planned}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
