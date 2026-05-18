"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, Download, Loader2, MessageSquare, Plus, SendHorizontal, Trash2 } from "lucide-react";
import ItemDetailModal from "@/components/ItemDetailModal";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ id: string; title: string; url?: string }>;
}

interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
}

const suggestedPrompts = [
  "What did I save this week?",
  "Do I have any tasks due soon?",
  "Summarise everything I saved about",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCitationItemId, setSelectedCitationItemId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const stored = window.localStorage.getItem("recall-chat-threads");
    if (!stored) return;

    const parsed = JSON.parse(stored) as ChatThread[];
    setThreads(parsed);
    if (parsed[0]) {
      setThreadId(parsed[0].id);
      setMessages(parsed[0].messages);
    }
  }, []);

  function upsertThread(nextId: string, nextMessages: Message[], seedTitle?: string) {
    const title =
      seedTitle ||
      nextMessages.find((message) => message.role === "user")?.content.slice(0, 48) ||
      "Untitled thread";

    setThreadId(nextId);
    setThreads((current) => {
      const nextThread: ChatThread = {
        id: nextId,
        title,
        messages: nextMessages,
        updatedAt: new Date().toISOString(),
      };
      const nextThreads = [nextThread, ...current.filter((thread) => thread.id !== nextId)].slice(0, 20);
      window.localStorage.setItem("recall-chat-threads", JSON.stringify(nextThreads));
      return nextThreads;
    });
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    setError(null);
    const activeThreadId = threadId || crypto.randomUUID();
    const userMessage: Message = { role: "user", content };
    const pendingMessages = [...messages, userMessage];
    setThreadId(activeThreadId);
    setMessages(pendingMessages);
    upsertThread(activeThreadId, pendingMessages, content);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: pendingMessages, conversation_id: activeThreadId }),
      });

      if (!response.ok) throw new Error("Chat failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const assistantMessage: Message = { role: "assistant", content: "" };
      setMessages((prev) => {
        const next = [...prev, assistantMessage];
        upsertThread(activeThreadId, next, content);
        return next;
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decoder = new TextDecoder();
        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) {
            continue;
          }

          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              setMessages((prev) => {
                const lastMessage = prev[prev.length - 1];
                if (!lastMessage || lastMessage.role !== "assistant") {
                  return prev;
                }

                const next = [
                  ...prev.slice(0, -1),
                  {
                    ...lastMessage,
                    content: lastMessage.content + data.text,
                  },
                ];
                upsertThread(activeThreadId, next, content);
                return next;
              });
            }

            if (data.done) {
              setMessages((prev) => {
                const lastMessage = prev[prev.length - 1];
                if (!lastMessage || lastMessage.role !== "assistant") {
                  return prev;
                }

                const next = [
                  ...prev.slice(0, -1),
                  {
                    ...lastMessage,
                    citations: data.citations,
                  },
                ];
                upsertThread(activeThreadId, next, content);
                return next;
              });
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setError("Chat is unavailable right now.");
      setMessages((prev) => {
        const fallbackMessage: Message = { role: "assistant", content: "Sorry, something went wrong." };
        const next = [...prev, fallbackMessage];
        upsertThread(activeThreadId, next, content);
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleSuggestedClick = (prompt: string) => {
    void sendMessage(prompt);
  };

  const startNewThread = () => {
    setThreadId(null);
    setMessages([]);
    setInput("");
    setError(null);
  };

  const deleteThread = (targetId: string) => {
    setThreads((current) => {
      const nextThreads = current.filter((thread) => thread.id !== targetId);
      window.localStorage.setItem("recall-chat-threads", JSON.stringify(nextThreads));
      return nextThreads;
    });

    if (threadId === targetId) {
      const next = threads.find((thread) => thread.id !== targetId);
      setThreadId(next?.id || null);
      setMessages(next?.messages || []);
    }
  };

  const exportCurrentThread = () => {
    const currentThread = threads.find((thread) => thread.id === threadId);
    if (!currentThread) {
      return;
    }

    const blob = new Blob([JSON.stringify(currentThread, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentThread.title.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || "recall-thread"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto h-[calc(100dvh-4rem)] min-h-[34rem] max-w-7xl px-4 py-4 md:px-6">
      <div className="grid h-full gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-modals border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-text-primary">Chat threads</h1>
              <p className="truncate text-xs text-text-muted">Stored locally in this browser</p>
            </div>
            <button
              type="button"
              onClick={startNewThread}
              className="inline-flex h-9 w-9 items-center justify-center rounded-buttons bg-brand text-white transition hover:bg-brand-hover"
              title="New thread"
              aria-label="New thread"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => {
                  setThreadId(thread.id);
                  setMessages(thread.messages);
                }}
                className={`w-full rounded-cards border px-3 py-3 text-left transition ${
                  thread.id === threadId
                    ? "border-brand bg-brand/10"
                    : "border-border bg-bg hover:border-brand/30 hover:bg-surface-2"
                }`}
              >
                <div className="line-clamp-1 text-sm font-semibold text-text-primary">{thread.title}</div>
                <div className="mt-1 line-clamp-2 text-xs text-text-muted">
                  {thread.messages[thread.messages.length - 1]?.content || "No messages yet"}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-text-muted">{new Date(thread.updatedAt).toLocaleString("en-IN")}</span>
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteThread(thread.id);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-buttons text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                    title="Delete thread"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            ))}
            {threads.length === 0 ? (
              <div className="rounded-cards border border-dashed border-border bg-bg px-4 py-8 text-sm text-text-muted">
                Start a conversation and it will appear here.
              </div>
            ) : null}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-modals border border-border bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-text-primary">
                  {threadId ? threads.find((thread) => thread.id === threadId)?.title || "Current thread" : "New conversation"}
                </h2>
                <p className="truncate text-xs text-text-muted">Ask natural questions and inspect source citations.</p>
              </div>
            </div>
            {threadId ? (
              <button
                type="button"
                onClick={exportCurrentThread}
                className="inline-flex items-center gap-2 rounded-buttons border border-border bg-bg px-3 py-2 text-xs text-text-primary hover:border-brand/40"
              >
                <Download className="h-3.5 w-3.5" />
                Export thread
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-bg/40 p-4">
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-cards border border-dashed border-border bg-bg px-6 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">Start with a question</h3>
                <p className="mt-2 max-w-xl text-sm text-text-muted">
                  Use timeframes, project names, or themes so Recall can pull from several enriched items.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSuggestedClick(prompt)}
                      className="rounded-full border border-border bg-surface px-4 py-2 text-sm text-text-primary transition hover:border-brand/40 hover:bg-surface-2"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-3xl rounded-[16px] border px-4 py-3 ${
                    msg.role === "user"
                      ? "border-brand bg-brand text-white"
                      : "border-border bg-surface text-text-primary"
                  }`}
                >
                  <div className={`mb-2 text-[11px] uppercase tracking-[0.16em] ${msg.role === "user" ? "text-white/70" : "text-text-muted"}`}>
                    {msg.role === "user" ? "You" : "Recall"}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6">{msg.content}</p>
                  {msg.citations && msg.citations.length > 0 ? (
                    <div className="mt-4 border-t border-border/60 pt-3">
                      <p className={`mb-2 text-[11px] uppercase tracking-[0.16em] ${msg.role === "user" ? "text-white/70" : "text-text-muted"}`}>
                        Sources
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.citations.map((cite) => (
                          <div key={cite.id} className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedCitationItemId(cite.id)}
                              className={`rounded-full px-3 py-1.5 text-xs transition ${
                                msg.role === "user"
                                  ? "bg-white/10 text-white hover:bg-white/20"
                                  : "bg-bg text-text-primary hover:bg-surface-2"
                              }`}
                            >
                              {cite.title}
                            </button>
                            {cite.url ? (
                              <a
                                href={cite.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`rounded-full px-3 py-1.5 text-xs transition ${
                                  msg.role === "user"
                                    ? "bg-white/10 text-white hover:bg-white/20"
                                    : "bg-bg text-brand hover:bg-brand/10"
                                }`}
                              >
                                Open source
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-[16px] border border-border bg-surface px-4 py-3 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  Thinking through your archive...
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-border p-4">
            <div className="rounded-modals border border-border bg-bg p-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="Ask about your saved content, projects, or reminders..."
                rows={3}
                className="w-full resize-none bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                disabled={loading}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-text-muted">Press Enter to send. Use Shift+Enter for a new line.</p>
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="inline-flex items-center gap-2 rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-hover disabled:opacity-50"
                >
                  <SendHorizontal className="h-4 w-4" />
                  Send
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>

      <ItemDetailModal
        itemId={selectedCitationItemId || ""}
        open={!!selectedCitationItemId}
        onClose={() => setSelectedCitationItemId(null)}
      />
    </div>
  );
}
