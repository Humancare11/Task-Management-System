import { BADGE_TONES } from "../ui/badgeTones.js";

const STATUS_STYLES = {
  pending: BADGE_TONES.amber,
  accepted: BADGE_TONES.emerald,
  expired: BADGE_TONES.neutral,
  cancelled: BADGE_TONES.red,
};

const STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  cancelled: "Cancelled",
};

export default function InvitationStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
