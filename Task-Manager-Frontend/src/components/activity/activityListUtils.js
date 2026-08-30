// Shared list helpers for real-time Activity feeds. Deduplication is always by
// `activity.id` so the same row delivered via socket + API never renders twice.

// Prepend a live activity, skipping it if its id is already in the list.
export function prependActivity(list, incoming) {
  if (!incoming || incoming.id == null) return list;
  if (list.some((a) => a.id === incoming.id)) return list;
  return [incoming, ...list];
}

// Merge a freshly fetched page 1 with whatever is already in state. Rows from
// the API win; any item already in state that is strictly NEWER than the newest
// API row (i.e. a live socket activity that landed mid-fetch) is carried over on
// top so the API/socket race never drops or duplicates an activity.
export function mergePage1(prev, rows) {
  if (!rows.length) return prev.length ? prev : rows;
  const ids = new Set(rows.map((r) => r.id));
  const newest = new Date(rows[0].created_at).getTime();
  const carried = prev.filter(
    (p) => !ids.has(p.id) && new Date(p.created_at).getTime() > newest
  );
  return [...carried, ...rows];
}

// Append a subsequent page, dropping any ids already present.
export function appendPage(prev, rows) {
  const seen = new Set(prev.map((a) => a.id));
  return [...prev, ...rows.filter((a) => !seen.has(a.id))];
}
