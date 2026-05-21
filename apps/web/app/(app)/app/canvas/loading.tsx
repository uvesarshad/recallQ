// xyflow + the /api/graph fetch take a noticeable beat on first hit. Give the
// user a deterministic grid placeholder that mirrors the final layout instead
// of an empty screen.
export default function CanvasLoading() {
  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden bg-bg">
      <div className="grid grid-cols-2 gap-6 p-10 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl border border-border bg-surface"
          />
        ))}
      </div>
    </div>
  );
}
