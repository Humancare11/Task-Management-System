// Loading placeholders for My Tasks — no fake task content.
export default function MyTasksSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-hair bg-surface-1" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-hair bg-surface-1 px-4 py-4"
          >
            <div className="h-4 w-14 animate-pulse rounded-full bg-surface-2" />
            <div className="h-4 flex-1 animate-pulse rounded bg-surface-2" />
            <div className="hidden h-4 w-20 animate-pulse rounded bg-surface-2 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
