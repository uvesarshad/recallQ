"use client";

import dynamic from "next/dynamic";

// `KnowledgeMap` pulls in `@xyflow/react` (~70KB gzip) plus its style sheet.
// Loading it dynamically with `ssr: false` keeps it out of the per-page JS
// for every other route in the app — Feed, Chat, Settings — and only fetches
// it when the user actually visits /app/canvas. The page-local
// loading.tsx fills the screen until the import resolves. `ssr: false` is
// only available inside a client component in Next 16, so this thin file
// exists solely to host the directive.
const KnowledgeMap = dynamic(() => import("@/components/KnowledgeMap"), {
  ssr: false,
});

export default function CanvasClient() {
  return <KnowledgeMap />;
}
