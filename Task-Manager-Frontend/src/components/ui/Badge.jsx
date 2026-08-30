import { BADGE_TONES } from "./badgeTones.js";

const roleVariants = {
  owner: BADGE_TONES.purple,
  admin: BADGE_TONES.blue,
  manager: BADGE_TONES.sky,
  member: BADGE_TONES.neutral,
  client: BADGE_TONES.amber,
};

const toneVariants = {
  neutral: BADGE_TONES.neutral,
  success: BADGE_TONES.emerald,
  warning: BADGE_TONES.amber,
  danger: BADGE_TONES.red,
  info: BADGE_TONES.sky,
};

export default function Badge({ role, tone = "neutral", children, className = "" }) {
  const style = role ? roleVariants[role] ?? toneVariants.neutral : toneVariants[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style} ${className}`}
    >
      {children ?? role}
    </span>
  );
}
