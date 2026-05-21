import { useEffect, useState } from "react";
import { apiClient } from "../../lib/client";
import {
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
  type StoredAuth,
} from "../../lib/auth-storage";
import { WEB_BASE_URL } from "../../lib/config";

type ActiveTab = { title: string; url: string } | null;

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function Popup() {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState<ActiveTab>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    void (async () => {
      const stored = await getStoredAuth();
      setAuth(stored);
      setAuthLoading(false);
    })();

    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs: chrome.tabs.Tab[]) => {
        const active = tabs[0];
        if (active?.url && /^https?:\/\//.test(active.url)) {
          setTab({ title: active.title ?? active.url, url: active.url });
        }
      });
  }, []);

  async function handleSignIn() {
    setStatus({ kind: "idle" });
    try {
      const redirectUrl = chrome.identity.getRedirectURL();
      const connectUrl = new URL(`${WEB_BASE_URL}/extension/connect`);
      connectUrl.searchParams.set("return_url", redirectUrl);
      connectUrl.searchParams.set("device_name", "Chrome");

      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: connectUrl.toString(),
        interactive: true,
      });
      if (!responseUrl) throw new Error("Sign-in cancelled");

      const parsed = new URL(responseUrl);
      const token = parsed.searchParams.get("token");
      const prefix = parsed.searchParams.get("prefix") ?? "";
      const deviceName = parsed.searchParams.get("device_name") ?? "Chrome";
      if (!token) throw new Error("No token in callback");

      const newAuth = { token, prefix, deviceName };
      await setStoredAuth(newAuth);
      setAuth(newAuth);
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Sign-in failed",
      });
    }
  }

  async function handleSignOut() {
    await clearStoredAuth();
    setAuth(null);
    setStatus({ kind: "idle" });
  }

  async function handleSave() {
    if (!tab || !auth) return;
    setStatus({ kind: "saving" });
    try {
      await apiClient.ingest.url({
        url: tab.url,
        capture_note: note.trim() || null,
        source: "extension",
      });
      setStatus({ kind: "success", message: "Saved to RecallQ" });
      setNote("");
    } catch (error) {
      // Bearer expired or revoked — drop it so the next popup open re-auths.
      const message =
        error instanceof Error ? error.message : "Save failed";
      if (message.toLowerCase().includes("unauthorized")) {
        await clearStoredAuth();
        setAuth(null);
      }
      setStatus({ kind: "error", message });
    }
  }

  if (authLoading) {
    return <div className="popup">Loading…</div>;
  }

  if (!auth) {
    return (
      <div className="popup">
        <h1>RecallQ</h1>
        <p className="subhead">Sign in to save anything from the web to your archive.</p>
        <button className="primary" type="button" onClick={() => void handleSignIn()}>
          Sign in with RecallQ
        </button>
        {status.kind === "error" ? (
          <div className="status error">{status.message}</div>
        ) : null}
      </div>
    );
  }

  if (!tab) {
    return (
      <div className="popup">
        <h1>RecallQ</h1>
        <p className="subhead">Open a webpage to capture it. Internal Chrome pages can&apos;t be saved.</p>
        <div className="footer">
          <span>Signed in</span>
          <button className="linklike" type="button" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const host = (() => {
    try {
      return new URL(tab.url).hostname.replace(/^www\./, "");
    } catch {
      return tab.url;
    }
  })();

  return (
    <div className="popup">
      <h1>Save to RecallQ</h1>
      <div className="current-tab">
        <div className="title">{tab.title}</div>
        <div className="host">{host}</div>
      </div>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note: remind me on 30 Jan · folder: work · #design"
        aria-label="Optional note"
      />
      <button
        className="primary"
        type="button"
        onClick={() => void handleSave()}
        disabled={status.kind === "saving"}
      >
        {status.kind === "saving" ? "Saving…" : "Save page"}
      </button>
      {status.kind === "success" ? (
        <div className="status success">{status.message}</div>
      ) : null}
      {status.kind === "error" ? (
        <div className="status error">{status.message}</div>
      ) : null}
      <div className="footer">
        <span>{auth.deviceName} · rq_{auth.prefix}…</span>
        <button className="linklike" type="button" onClick={() => void handleSignOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
