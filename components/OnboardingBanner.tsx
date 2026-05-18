"use client";

import { BookOpen, FileUp, Link, MessageSquare, Network } from "lucide-react";
import { openCreateDialog } from "@/components/CreateItemDialog";

const steps = [
  {
    Icon: Link,
    title: "Save a link",
    description: "Paste any URL into the capture bar. Recall will fetch the title, summary, and tags automatically.",
    action: "Try it now",
    color: "text-item-link",
    bg: "bg-item-link/10",
  },
  {
    Icon: FileUp,
    title: "Upload a file",
    description: "PDFs, images, Word docs, and spreadsheets are all supported. Use the File tab in the capture dialog.",
    action: "Open capture",
    color: "text-item-file",
    bg: "bg-item-file/10",
  },
  {
    Icon: MessageSquare,
    title: "Chat with your archive",
    description: "Once you have a few items saved, ask questions in the Chat view and get cited answers from your content.",
    action: null,
    color: "text-brand",
    bg: "bg-brand/10",
  },
  {
    Icon: Network,
    title: "Explore the knowledge graph",
    description: "Recall automatically links related items. Visit the Graph view to see your archive as a connected map.",
    action: null,
    color: "text-item-note",
    bg: "bg-item-note/10",
  },
];

export default function OnboardingBanner() {
  return (
    <div className="mx-auto mt-6 max-w-7xl px-5 pb-10">
      <div className="mb-6 rounded-modals border border-brand/20 bg-brand/5 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand/10 p-2">
            <BookOpen className="h-5 w-5 text-brand" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Welcome to Recall</h3>
            <p className="text-sm text-text-muted">Your library is empty. Here are four ways to get started.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map(({ Icon, title, description, action, color, bg }) => (
          <div key={title} className="rounded-cards border border-border bg-surface p-5">
            <div className="flex items-start gap-4">
              <div className={`shrink-0 rounded-lg p-2 ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
                <p className="mt-1 text-sm text-text-muted">{description}</p>
                {action && (
                  <button
                    type="button"
                    onClick={openCreateDialog}
                    className="mt-3 text-xs font-medium text-brand hover:underline"
                  >
                    {action} →
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
