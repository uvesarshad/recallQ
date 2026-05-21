// Skeleton matching the chat two-pane layout: narrow thread rail + wide
// conversation surface. Replaces the blank screen on first paint while the
// thread list and message history queries resolve.
export default function ChatLoading() {
  return (
    <div className="grid h-[calc(100vh-4rem)] gap-0 md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-surface p-3 md:block">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-buttons bg-surface-2" />
          ))}
        </div>
      </aside>
      <div className="flex flex-col p-6">
        <div className="flex-1 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-modals border border-border bg-surface" />
          ))}
        </div>
        <div className="mt-4 h-14 animate-pulse rounded-modals border border-border bg-surface" />
      </div>
    </div>
  );
}
