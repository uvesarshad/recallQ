import { useCallback, useEffect, useRef, useState } from "react";
import type { ListItem } from "@recall/api-client";
import { apiClient } from "../../lib/client";
import {
  clearStoredAuth,
  getStoredAuth,
  type StoredAuth,
} from "../../lib/auth-storage";
import { signInWithRecallQ } from "../../lib/auth-flow";
import { canSyncSettings, getPlan, type Plan } from "../../lib/plan";
import {
  DEFAULT_SETTINGS,
  getSettings,
  setSettings,
  type ExtensionSettings,
} from "../../lib/settings";
import { WEB_BASE_URL } from "../../lib/config";

type View = "feed" | "settings";

export function App() {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>("feed");

  useEffect(() => {
    void (async () => {
      setAuth(await getStoredAuth());
      setAuthLoading(false);
    })();
  }, []);

  async function handleSignIn() {
    try {
      setAuth(await signInWithRecallQ());
    } catch {
      // Cancelled or failed — stay on the signed-out screen.
    }
  }

  async function handleSignOut() {
    await clearStoredAuth();
    setAuth(null);
  }

  if (authLoading) {
    return <div className="app-loading">Loading…</div>;
  }

  if (!auth) {
    return (
      <div className="app-signedout">
        <div className="signin-card">
          <h1>RecallQ</h1>
          <p>Sign in to browse, search, and capture your archive.</p>
          <button className="primary" type="button" onClick={() => void handleSignIn()}>
            Sign in with RecallQ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">RecallQ</div>
        <nav className="app-nav">
          <button
            type="button"
            className={view === "feed" ? "active" : ""}
            onClick={() => setView("feed")}
          >
            Feed
          </button>
          <button
            type="button"
            className={view === "settings" ? "active" : ""}
            onClick={() => setView("settings")}
          >
            Settings
          </button>
        </nav>
        <button className="linklike" type="button" onClick={() => void handleSignOut()}>
          Sign out
        </button>
      </header>
      <main className="app-main">
        {view === "feed" ? <Feed /> : <Settings />}
      </main>
    </div>
  );
}

// --- Feed (capture + search + list) --------------------------------------

function Feed() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const requestId = useRef(0);

  const load = useCallback(async (q: string, append: string | null) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.items.list({
        limit: 30,
        q: q || undefined,
        cursor: append || undefined,
      });
      if (id !== requestId.current) return; // a newer request superseded this
      setItems((prev) => (append ? [...prev, ...res.items] : res.items));
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // Debounced search / initial load.
  useEffect(() => {
    const handle = setTimeout(() => void load(query, null), query ? 250 : 0);
    return () => clearTimeout(handle);
  }, [query, load]);

  return (
    <div className="feed">
      <Capture onCaptured={() => void load(query, null)} />
      <input
        className="search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your archive…"
        aria-label="Search your archive"
      />
      {error ? <div className="status error">{error}</div> : null}
      {!loading && items.length === 0 ? (
        <div className="empty">{query ? "No matches." : "Nothing saved yet."}</div>
      ) : null}
      <ul className="item-list">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </ul>
      {loading ? <div className="muted">Loading…</div> : null}
      {hasMore && !loading ? (
        <button className="secondary" type="button" onClick={() => void load(query, cursor)}>
          Load more
        </button>
      ) : null}
    </div>
  );
}

function ItemRow({ item }: { item: ListItem }) {
  const host = (() => {
    if (!item.raw_url) return null;
    try {
      return new URL(item.raw_url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();
  const title = item.title || item.raw_url || item.raw_text?.slice(0, 80) || "Untitled";
  return (
    <li className="item-row">
      <div className="item-body">
        <div className="item-title">{title}</div>
        {item.summary ? <div className="item-summary">{item.summary}</div> : null}
        <div className="item-meta">
          {host ? <span>{host}</span> : <span>{item.type}</span>}
          {!item.enriched ? <span className="enriching">Enriching…</span> : null}
        </div>
      </div>
      {item.raw_url ? (
        <a className="open-link" href={item.raw_url} target="_blank" rel="noreferrer">
          Open
        </a>
      ) : null}
    </li>
  );
}

function Capture({ onCaptured }: { onCaptured: () => void }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    const text = value.trim();
    if (!text || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const isUrl = /^https?:\/\/\S+$/i.test(text);
      if (isUrl) await apiClient.ingest.url({ url: text, source: "extension" });
      else await apiClient.ingest.text({ text, source: "extension" });
      setValue("");
      setMsg("Saved");
      onCaptured();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="capture">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
        }}
        placeholder="Paste a link or type a note, then press Enter"
        aria-label="Capture a link or note"
      />
      <button className="primary" type="button" onClick={() => void save()} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      {msg ? <span className="capture-msg">{msg}</span> : null}
    </div>
  );
}

// --- Settings (incl. plan-gated sync) ------------------------------------

function Settings() {
  const [settings, setLocal] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [plan, setPlan] = useState<Plan>("free");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const [s, p] = await Promise.all([getSettings(), getPlan()]);
      setLocal(s);
      setPlan(p);
      setReady(true);
    })();
  }, []);

  const syncAllowed = canSyncSettings(plan);

  async function update(patch: Partial<ExtensionSettings>) {
    const next = await setSettings(patch);
    setLocal(next);
  }

  if (!ready) return <div className="muted">Loading…</div>;

  return (
    <div className="settings">
      <label className="setting">
        <input
          type="checkbox"
          checked={settings.closeTabsAfterSending}
          onChange={(e) => void update({ closeTabsAfterSending: e.target.checked })}
        />
        <span>
          <strong>Close tabs after sending</strong>
          <small>When you send tabs to RecallQ, close them to clear the window.</small>
        </span>
      </label>

      <label className={`setting ${syncAllowed ? "" : "disabled"}`}>
        <input
          type="checkbox"
          checked={settings.syncEnabled && syncAllowed}
          disabled={!syncAllowed}
          onChange={(e) => void update({ syncEnabled: e.target.checked })}
        />
        <span>
          <strong>Sync settings across devices</strong>
          <small>
            {syncAllowed
              ? "Keep these preferences in sync across your signed-in Chrome profiles."
              : "Available on Starter and Pro plans."}
          </small>
        </span>
      </label>

      {!syncAllowed ? (
        <a className="upgrade" href={`${WEB_BASE_URL}/app/settings/billing`} target="_blank" rel="noreferrer">
          Upgrade to enable sync →
        </a>
      ) : null}

      <div className="plan-badge">
        Plan: <strong>{plan}</strong>
      </div>
    </div>
  );
}
