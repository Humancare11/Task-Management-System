// Skeleton placeholders shown while monitoring data loads — no fake values.
function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-hair bg-surface-1 p-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-surface-2" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/2 rounded bg-surface-2" />
          <div className="h-2.5 w-1/3 rounded bg-surface-2" />
        </div>
        <div className="h-5 w-14 rounded-full bg-surface-2" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-hair pt-3">
        <div className="h-8 rounded bg-surface-2" />
        <div className="h-8 rounded bg-surface-2" />
      </div>
    </div>
  );
}

export default function MonitoringSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-hair bg-surface-1"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
