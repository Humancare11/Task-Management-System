const sizes = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
};

export default function Avatar({ firstName, lastName, avatarUrl, size = "md" }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${firstName ?? ""} ${lastName ?? ""}`.trim()}
        className={`${sizes[size]} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`flex ${sizes[size]} shrink-0 items-center justify-center rounded-full bg-primary-600 font-semibold text-white`}
    >
      {initials || "?"}
    </span>
  );
}
