// Skeleton rendered while any /(app) page server component is resolving.
// The AppShell layout (sidebar, header) is already mounted from the layout
// file, so this only fills the main content area.
export default function AppLoading() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <div className="h-7 w-48 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-4 flex gap-2">
        <div className="h-9 w-20 animate-pulse rounded-full bg-surface-2" />
        <div className="h-9 w-20 animate-pulse rounded-full bg-surface-2" />
        <div className="h-9 w-20 animate-pulse rounded-full bg-surface-2" />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-modals border border-border bg-surface"
          />
        ))}
      </div>
    </div>
  );
}
