"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bot, X, Send, Sparkles } from "lucide-react";
import { T, FONT, MONO, SPRING_UI } from "@recall/tokens";

interface Citation {
  id: string;
  title: string;
  url?: string;
  snippet?: string;
}

interface Msg {
  role: "user" | "bot";
  text: string;
  citations?: Citation[];
}

const INIT_MSG: Msg = {
  role: "bot",
  text: 'Ask me anything in your archive — try "that paper on RAG chunking" or "the cold brew recipe."',
};

export default function ChatDock() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([INIT_MSG]);
  const [val, setVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }, [msgs, reduce]);

  useEffect(() => {
    if (open) {
      // Focus as soon as the panel is laid out — no fixed timer tied to the
      // entrance spring, so the field is usable immediately (and stays
      // interruptible) rather than locked out until the animation finishes.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const send = useCallback(async () => {
    const text = val.trim();
    if (!text || loading) return;

    setMsgs((prev) => [...prev, { role: "user", text }]);
    setVal("");
    setLoading(true);

    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...msgs.map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text })),
            { role: "user", content: text },
          ],
          conversation_id: conversationId,
        }),
      });

      if (!res.ok) {
        setMsgs((prev) => [
          ...prev,
          { role: "bot", text: "Couldn't reach the archive. Try that again." },
        ]);
        setLoading(false);
        return;
      }

      const contentType = res.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream")) {
        // SSE streaming
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream body");

        // Add placeholder bot message
        setMsgs((prev) => [...prev, { role: "bot", text: "" }]);

        const decoder = new TextDecoder();
        let buffer = "";
        let finalCitations: Citation[] | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                setMsgs((prev) => {
                  const last = prev[prev.length - 1];
                  if (!last || last.role !== "bot") return prev;
                  return [
                    ...prev.slice(0, -1),
                    { ...last, text: last.text + (data.text as string) },
                  ];
                });
              }
              if (data.done && data.citations) {
                finalCitations = data.citations as Citation[];
                if (data.conversationId) {
                  setConversationId(data.conversationId as string);
                }
              }
            } catch {
              // skip malformed chunk
            }
          }
        }

        if (finalCitations) {
          setMsgs((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "bot") return prev;
            return [...prev.slice(0, -1), { ...last, citations: finalCitations }];
          });
        }
      } else {
        // JSON fallback
        const data = (await res.json()) as {
          reply?: string;
          citations?: Citation[];
          conversationId?: string;
        };
        if (data.conversationId) setConversationId(data.conversationId);
        setMsgs((prev) => [
          ...prev,
          { role: "bot", text: data.reply ?? "Done.", citations: data.citations },
        ]);
      }
    } catch {
      setMsgs((prev) => [
        ...prev,
        { role: "bot", text: "Couldn't reach the archive. Try that again." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [val, msgs, loading, conversationId]);

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <>
      {/* Floating bot button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="chat-fab"
            initial={reduce ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
            transition={SPRING_UI}
            onClick={() => setOpen(true)}
            aria-label="Open AI chat"
            style={{
              position: "fixed",
              bottom: 22,
              right: 22,
              zIndex: 60,
              width: 58,
              height: 58,
              borderRadius: 18,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg,#3D7DFF,#22C9A8)",
              boxShadow: "0 12px 30px rgba(61,125,255,.4)",
              animation: reduce ? undefined : "float 3.5s ease-in-out infinite",
            }}
          >
            <Bot size={26} color="#fff" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            initial={reduce ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
            transition={SPRING_UI}
            style={{
              position: "fixed",
              bottom: 22,
              right: 22,
              zIndex: 70,
              width: "min(380px, calc(100vw - 36px))",
              height: "min(540px, 72vh)",
              transformOrigin: "bottom right",
              borderRadius: 24,
              background: T.glass,
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
              border: `1.5px solid ${T.glassEdge}`,
              boxShadow: T.shadowLift,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                borderBottom: `1px solid ${T.line}`,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexShrink: 0,
              }}
            >
              {/* Bot icon circle */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#3D7DFF,#22C9A8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bot size={16} color="#fff" />
              </div>

              {/* Title + subtitle */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: FONT,
                    fontSize: 14,
                    fontWeight: 700,
                    color: T.ink,
                    lineHeight: 1.3,
                  }}
                >
                  Ask your archive
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 10.5,
                    color: T.mint,
                    lineHeight: 1.4,
                    marginTop: 1,
                  }}
                >
                  <Sparkles
                    size={9}
                    style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }}
                  />
                  RAG · semantic search
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: T.glass,
                  border: `1px solid ${T.glassEdge}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: T.inkSoft,
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <AnimatePresence initial={false}>
              {msgs.map((m, i) => (
                <motion.div
                  key={i}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? { duration: 0.12 } : SPRING_UI}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "84%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      padding: "10px 13px",
                      borderRadius: 14,
                      borderBottomRightRadius: m.role === "user" ? 4 : 14,
                      borderBottomLeftRadius: m.role === "bot" ? 4 : 14,
                      background:
                        m.role === "user"
                          ? "linear-gradient(135deg,#3D7DFF,#2B5FD9)"
                          : "rgba(255,255,255,.8)",
                      color: m.role === "user" ? "#fff" : T.ink,
                      border:
                        m.role === "bot" ? `1px solid ${T.glassEdge}` : "none",
                      fontFamily: FONT,
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {m.text}
                    {!m.text && m.role === "bot" && loading && (
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: T.mint,
                          animation: "float 1s ease-in-out infinite",
                          verticalAlign: "middle",
                        }}
                      />
                    )}
                  </div>

                  {/* Citations */}
                  {m.citations && m.citations.length > 0 && (
                    <motion.div
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={reduce ? { duration: 0.12 } : SPRING_UI}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 5,
                        paddingLeft: m.role === "bot" ? 2 : 0,
                        paddingRight: m.role === "user" ? 2 : 0,
                      }}
                    >
                      {m.citations.map((c, ci) => (
                        <motion.button
                          key={c.id}
                          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={
                            reduce
                              ? { duration: 0.12 }
                              : { ...SPRING_UI, delay: ci * 0.04 }
                          }
                          onClick={() => {
                            window.location.href = "/app?q=" + encodeURIComponent(c.id);
                          }}
                          title={c.title}
                          style={{
                            fontFamily: MONO,
                            fontSize: 11,
                            color: T.azure,
                            background: "rgba(61,125,255,0.08)",
                            border: `1px solid rgba(61,125,255,0.22)`,
                            borderRadius: 20,
                            padding: "3px 10px",
                            cursor: "pointer",
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.snippet ? c.snippet.slice(0, 40) + "…" : c.title}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              ))}
              </AnimatePresence>

              {/* Loading dots when waiting for first token */}
              {loading && msgs[msgs.length - 1]?.role !== "bot" && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    padding: "10px 13px",
                    borderRadius: 14,
                    borderBottomLeftRadius: 4,
                    background: "rgba(255,255,255,.8)",
                    border: `1px solid ${T.glassEdge}`,
                    display: "flex",
                    gap: 5,
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((n) => (
                    <span
                      key={n}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: T.inkFaint,
                        animation: `float 1.2s ease-in-out ${n * 0.2}s infinite`,
                        display: "inline-block",
                      }}
                    />
                  ))}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div
              style={{
                borderTop: `1px solid ${T.line}`,
                padding: 12,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <input
                ref={inputRef}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about anything you saved…"
                disabled={loading}
                style={{
                  flex: 1,
                  border: `1.5px solid ${T.glassEdge}`,
                  background: "rgba(255,255,255,.8)",
                  borderRadius: 12,
                  padding: "10px 13px",
                  fontFamily: FONT,
                  fontSize: 13.5,
                  color: T.ink,
                  outline: "none",
                  lineHeight: 1.4,
                }}
              />
              <button
                onClick={() => void send()}
                disabled={loading || !val.trim()}
                aria-label="Send message"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  border: "none",
                  cursor: loading || !val.trim() ? "not-allowed" : "pointer",
                  background:
                    loading || !val.trim()
                      ? T.line
                      : "linear-gradient(135deg,#3D7DFF,#22C9A8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "background var(--duration-base) var(--ease-out)",
                  opacity: loading || !val.trim() ? 0.5 : 1,
                }}
              >
                <Send size={16} color={loading || !val.trim() ? T.inkFaint : "#fff"} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
