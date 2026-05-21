"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2, Loader2, RefreshCw, Unplug } from "lucide-react";

type TelegramTokenResponse = {
  token: string;
  botUsername: string;
  botUrl: string;
};

type TelegramStatusResponse = {
  linked: boolean;
  botUsername: string;
  botUrl: string;
};

export default function TelegramConnect({ initialLinked }: { initialLinked: boolean }) {
  const [isLinked, setIsLinked] = useState(initialLinked);
  const [token, setToken] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState("RecallBot");
  const [botUrl, setBotUrl] = useState("https://t.me/RecallBot");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/user/telegram-status");
      if (!res.ok) {
        throw new Error("Failed to load Telegram status");
      }

      const data: TelegramStatusResponse = await res.json();
      setIsLinked(data.linked);
      setBotUsername(data.botUsername || "RecallBot");
      setBotUrl(data.botUrl || "https://t.me/RecallBot");
      if (data.linked) {
        setToken(null);
      }
    } catch (err) {
      console.error("Status check failed:", err);
    }
  };

  const generateToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/telegram-token", { method: "POST" });
      if (!res.ok) {
        throw new Error("Failed to generate Telegram connect link");
      }

      const data: TelegramTokenResponse = await res.json();
      setToken(data.token);
      setBotUsername(data.botUsername || "RecallBot");
      setBotUrl(data.botUrl || "https://t.me/RecallBot");
    } catch (err) {
      console.error("Failed to generate token:", err);
      setError("Could not generate a Telegram connect link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/user/telegram-link", { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to disconnect Telegram");
      }

      setIsLinked(false);
      setToken(null);
    } catch (err) {
      console.error("Disconnect failed:", err);
      setError("Could not disconnect Telegram right now.");
    } finally {
      setDisconnecting(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (token && !isLinked) {
      interval = setInterval(() => {
        void checkStatus();
      }, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [token, isLinked]);

  const copyToClipboard = () => {
    if (!token) return;
    void navigator.clipboard.writeText(`/connect ${token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLinked) {
    return (
      <div className="space-y-4 py-2">
        <div className="flex flex-col items-center justify-center py-2 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
            <Check className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-sm font-medium text-text-primary">Telegram is connected</p>
          <p className="mt-1 text-xs text-text-mid">
            On iPhone, share to Telegram or forward messages/files directly to @{botUsername}.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={botUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-buttons border border-border bg-surface-2 px-4 py-2.5 text-xs font-semibold text-text-primary transition-colors hover:bg-bg"
          >
            Open @{botUsername} <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="inline-flex items-center justify-center gap-2 rounded-buttons border border-border px-4 py-2.5 text-xs font-semibold text-text-mid transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
            Disconnect
          </button>
        </div>

        <div className="rounded-input border border-border bg-surface-2 p-3 text-xs text-text-mid">
          Best mobile flow: tap share in Safari or any app, choose Telegram, then send to @{botUsername}. Recall will ingest the link, text, photo, or document from the bot chat.
        </div>
        {error ? <p className="text-center text-xs text-red-400">{error}</p> : null}
      </div>
    );
  }

  if (token) {
    return (
      <div className="space-y-4">
        <div className="rounded-input border border-brand/30 bg-brand/5 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-brand/15 p-2 text-brand">
              <Link2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary">Open Telegram and finish linking</p>
              <p className="mt-1 text-xs text-text-mid">
                The button below opens @{botUsername} with your secure connect token already attached.
              </p>
            </div>
          </div>
        </div>

        <a
          href={botUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-buttons bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          Open Telegram Bot <ExternalLink className="h-4 w-4" />
        </a>

        <div className="rounded-input border border-dashed border-brand bg-brand/5 p-4 text-center">
          <p className="mb-3 text-xs text-text-mid">
            If Telegram does not open the connect flow automatically, copy and send this command to{" "}
            <a href={botUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
              @{botUsername}
            </a>
            :
          </p>
          <div className="flex items-center gap-2 rounded-buttons bg-surface-2 p-3">
            <code className="flex-1 truncate text-xs font-mono text-brand">/connect {token}</code>
            <button onClick={copyToClipboard} className="rounded-md p-1.5 transition-colors hover:bg-surface">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-text-muted" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-input border border-border bg-surface-2 px-3 py-2">
          <p className="text-[11px] text-text-muted">Waiting for Telegram to confirm the connection.</p>
          <button
            onClick={() => void checkStatus()}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
        {error ? <p className="text-center text-xs text-red-400">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="rounded-input border border-border bg-surface-2 p-4 text-sm text-text-mid">
        Best fallback for iPhone and iPad: share anything to Telegram, then send it to @{botUsername}. Recall will save it from there.
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => void generateToken()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-buttons bg-brand px-6 py-2.5 text-xs font-semibold text-white transition-all hover:bg-brand-hover disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {loading ? "Generating..." : "Connect Telegram"}
        </button>
        <a
          href={botUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-xs font-semibold text-brand hover:underline"
        >
          Open @{botUsername} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {error ? <p className="text-center text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
