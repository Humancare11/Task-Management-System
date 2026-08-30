import { BADGE_TONES } from "../ui/badgeTones.js";

const PRIORITY_STYLES = {
  low: BADGE_TONES.neutral,
  medium: BADGE_TONES.amber,
  high: BADGE_TONES.orange,
  urgent: BADGE_TONES.red,
};

export default function TaskPriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium}`}
    >
      {priority}
    </span>
  );
}
