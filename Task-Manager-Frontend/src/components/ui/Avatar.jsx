import { API_ORIGIN } from "../../api/client.js";

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
  xl: "h-20 w-20 text-2xl",
};

// Backend avatar URLs are stored relative ("/uploads/<file>"); resolve those
// against the API origin. Absolute URLs (http/https, data:) pass through.
function resolveAvatarUrl(url) {
  if (!url) return null;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return `${API_ORIGIN}${url}`;
  return url;
}

export default function Avatar({ firstName, lastName, avatarUrl, size = "md" }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const src = resolveAvatarUrl(avatarUrl);

  if (src) {
    return (
      <img
        src={src}
        alt={`${firstName ?? ""} ${lastName ?? ""}`.trim()}
        className={`${sizes[size]} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`flex ${sizes[size]} shrink-0 items-center justify-center rounded-full bg-accentblue font-semibold text-white`}
    >
      {initials || "?"}
    </span>
  );
}
