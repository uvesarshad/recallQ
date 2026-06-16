import { useEffect, useState } from "react";
import {
  clearStoredAuth,
  getStoredAuth,
  type StoredAuth,
} from "../../lib/auth-storage";
import { signInWithRecallQ } from "../../lib/auth-flow";
import { addUrls } from "../../lib/local-archive";
import { runSync } from "../../lib/sync";

type ActiveTab = { title: string; url: string } | null;

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function Popup() {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [tab, setTab] = useState<ActiveTab>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    void getStoredAuth().then(setAuth);
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs: chrome.tabs.Tab[]) => {
        const active = tabs[0];
        if (active?.url && /^https?:\/\//.test(active.url)) {
          setTab({ title: active.title ?? active.url, url: active.url });
        }
      });
  }, []);

  async function handleSave() {
    if (!tab) return;
    setStatus({ kind: "saving" });
    try {
      // Local-first: always saves, even signed-out. Sync runs if it's enabled.
      await addUrls([{ url: tab.url, title: tab.title, note: note.trim() || null }]);
      void runSync().catch(() => {});
      setStatus({ kind: "success", message: "Saved to RecallQ" });
      setNote("");
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Save failed",
      });
    }
  }

  async function handleSignIn() {
    try {
      setAuth(await signInWithRecallQ());
    } catch {
      /* cancelled */
    }
  }

  async function handleSignOut() {
    await clearStoredAuth();
    setAuth(null);
  }

  if (!tab) {
    return (
      <div className="popup">
        <h1>RecallQ</h1>
        <p className="subhead">
          Open a webpage to save it. Internal Chrome pages can&apos;t be saved.
        </p>
        <Footer auth={auth} onSignIn={handleSignIn} onSignOut={handleSignOut} />
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
        placeholder="Optional note"
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
      <Footer auth={auth} onSignIn={handleSignIn} onSignOut={handleSignOut} />
    </div>
  );
}

function Footer({
  auth,
  onSignIn,
  onSignOut,
}: {
  auth: StoredAuth | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="footer">
      {auth ? (
        <>
          <span>{auth.deviceName} · cloud sync</span>
          <button className="linklike" type="button" onClick={() => void onSignOut()}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <span>Saved locally</span>
          <button className="linklike" type="button" onClick={() => void onSignIn()}>
            Sign in to sync
          </button>
        </>
      )}
    </div>
  );
}
