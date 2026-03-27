"use client";

import { useState, useRef, useEffect } from "react";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
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

  function persistThreads(nextThreads: ChatThread[]) {
    setThreads(nextThreads);
    window.localStorage.setItem("recall-chat-threads", JSON.stringify(nextThreads));
  }

  function upsertThread(nextMessages: Message[], seedTitle?: string) {
    const nextId = threadId || crypto.randomUUID();
    setThreadId(nextId);
    const title = seedTitle || nextMessages.find((message) => message.role === "user")?.content.slice(0, 40) || "Untitled thread";
    const nextThread: ChatThread = {
      id: nextId,
      title,
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
    };
    const nextThreads = [nextThread, ...threads.filter((thread) => thread.id !== nextId)].slice(0, 20);
    persistThreads(nextThreads);
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMessage: Message = { role: "user", content };
    const pendingMessages = [...messages, userMessage];
    setMessages(pendingMessages);
    upsertThread(pendingMessages, content);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: pendingMessages, conversation_id: threadId }),
      });

      if (!response.ok) throw new Error("Chat failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const assistantMessage: Message = { role: "assistant", content: "" };
      setMessages((prev) => {
        const next = [...prev, assistantMessage];
        upsertThread(next, content);
        return next;
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decoder = new TextDecoder();
        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  lastMsg.content += data.text;
                  upsertThread(newMessages, content);
                  return newMessages;
                });
              }
              if (data.done) {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  lastMsg.citations = data.citations;
                  upsertThread(newMessages, content);
                  return newMessages;
                });
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestedClick = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-1 md:grid-cols-[280px_1fr]">
      <aside className="border-r border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h1 className="text-base font-semibold text-text-primary">Threads</h1>
          <button
            onClick={() => {
              setThreadId(null);
              setMessages([]);
            }}
            className="rounded-buttons border border-border px-3 py-2 text-xs text-text-muted hover:bg-surface-2"
          >
            New
          </button>
        </div>
        <div className="space-y-2 p-3">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => {
                setThreadId(thread.id);
                setMessages(thread.messages);
              }}
              className={`w-full rounded-buttons border px-3 py-3 text-left ${
                thread.id === threadId ? "border-brand bg-brand/10" : "border-border bg-bg hover:bg-surface-2"
              }`}
            >
              <div className="line-clamp-1 text-sm font-medium text-text-primary">{thread.title}</div>
              <div className="mt-1 text-xs text-text-muted">{new Date(thread.updatedAt).toLocaleString("en-IN")}</div>
            </button>
          ))}
          {threads.length === 0 ? <p className="px-2 text-sm text-text-muted">No chat history yet.</p> : null}
        </div>
      </aside>

      <div className="flex min-h-0 flex-col">
      <div className="border-b border-border p-4">
        <h2 className="text-xl font-semibold text-text-primary">Chat with your archive</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-muted mb-4">Ask questions about your saved content</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSuggestedClick(prompt)}
                  className="rounded-md border border-border bg-surface px-4 py-2 text-sm transition-colors hover:bg-surface-2"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === "user"
                  ? "bg-brand text-white"
                  : "bg-surface border border-border text-text-primary"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border/50">
                  <p className="text-xs text-text-muted mb-1">Based on:</p>
                  <div className="flex flex-wrap gap-1">
                    {msg.citations.map((cite) => (
                      <a
                        key={cite.id}
                        href={cite.url || `/app/item/${cite.id}`}
                        className="text-xs text-brand hover:underline"
                      >
                        {cite.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your saved content..."
            className="flex-1 rounded-md border border-border bg-surface px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-md bg-brand px-4 py-2 text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
