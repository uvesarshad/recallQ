import { useCallback, useEffect, useState } from "react";
import {
  ARCHIVE_KEY,
  addText,
  addUrls,
  getVisible,
  search,
  softDelete,
  type LocalItem,
} from "../../lib/local-archive";
import {
  clearStoredAuth,
  getStoredAuth,
  type StoredAuth,
} from "../../lib/auth-storage";
import { signInWithRecallQ } from "../../lib/auth-flow";
import { canUseCloudSync, getPlan, type Plan } from "../../lib/plan";
import {
  DEFAULT_SETTINGS,
  getSettings,
  setSettings,
  type ExtensionSettings,
} from "../../lib/settings";
import { runSync } from "../../lib/sync";
import { WEB_BASE_URL } from "../../lib/config";

type View = "feed" | "settings";

export function App() {
  const [view, setView] = useState<View>("feed");
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [settings, setSettingsState] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const refreshMeta = useCallback(async () => {
    const [a, s] = await Promise.all([getStoredAuth(), getSettings()]);
    setAuth(a);
    setSettingsState(s);
    setPlan(a ? await getPlan() : "free");
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refreshMeta();
  }, [refreshMeta]);

  const cloudEnabled = Boolean(auth) && settings.cloudSyncEnabled && canUseCloudSync(plan);

  if (!loaded) return <div className="app-loading">Loading…</div>;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">RecallQ</div>
        <nav className="app-nav">
          <button type="button" className={view === "feed" ? "active" : ""} onClick={() => setView("feed")}>
            Feed
          </button>
          <button type="button" className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>
            Settings
          </button>
        </nav>
        <span className="cloud-state">{cloudEnabled ? "Cloud sync on" : "Local only"}</span>
      </header>
      <main className="app-main">
        {view === "feed" ? (
          <Feed cloudEnabled={cloudEnabled} />
        ) : (
          <SettingsView auth={auth} plan={plan} settings={settings} onChange={refreshMeta} />
        )}
      </main>
    </div>
  );
}

// --- Feed ----------------------------------------------------------------

function Feed({ cloudEnabled }: { cloudEnabled: boolean }) {
  const [items, setItems] = useState<LocalItem[]>([]);
  const [query, setQuery] = useState("");
  const [capture, setCapture] = useState("");

  const reload = useCallback(async () => {
    setItems(query.trim() ? await search(query) : await getVisible());
  }, [query]);

  useEffect(() => {
    const handle = setTimeout(() => void reload(), query ? 200 : 0);
    return () => clearTimeout(handle);
  }, [query, reload]);

  // Refresh whenever the archive changes (background saves, sync pulls).
  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area === "local" && changes[ARCHIVE_KEY]) void reload();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [reload]);

  async function handleCapture() {
    const text = capture.trim();
    if (!text) return;
    if (/^https?:\/\/\S+$/i.test(text)) await addUrls([{ url: text }]);
    else await addText(text);
    void runSync().catch(() => {});
    setCapture("");
    await reload();
  }

  async function remove(localId: string) {
    await softDelete(localId);
    void runSync().catch(() => {});
    await reload();
  }

  return (
    <div className="feed">
      <div className="capture">
        <input
          type="text"
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCapture();
          }}
          placeholder="Paste a link or type a note, then press Enter"
          aria-label="Capture a link or note"
        />
        <button className="primary" type="button" onClick={() => void handleCapture()}>
          Save
        </button>
      </div>
      <input
        className="search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your archive…"
        aria-label="Search your archive"
      />
      {items.length === 0 ? (
        <div className="empty">{query ? "No matches." : "Nothing saved yet."}</div>
      ) : null}
      <ul className="item-list">
        {items.map((item) => (
          <ItemRow key={item.localId} item={item} cloudEnabled={cloudEnabled} onDelete={remove} />
        ))}
      </ul>
    </div>
  );
}

function ItemRow({
  item,
  cloudEnabled,
  onDelete,
}: {
  item: LocalItem;
  cloudEnabled: boolean;
  onDelete: (localId: string) => void;
}) {
  const host = (() => {
    if (!item.url) return null;
    try {
      return new URL(item.url).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();
  const title = item.title || item.url || "Untitled";
  return (
    <li className="item-row">
      <div className="item-body">
        <div className="item-title">{title}</div>
        {item.summary ? <div className="item-summary">{item.summary}</div> : null}
        <div className="item-meta">
          {host ? <span>{host}</span> : <span>{item.type}</span>}
          {cloudEnabled ? (
            <span className={item.serverId ? "badge synced" : "badge pending"}>
              {item.serverId ? "Synced" : "Pending"}
            </span>
          ) : null}
        </div>
      </div>
      <div className="item-actions">
        {item.url ? (
          <a className="open-link" href={item.url} target="_blank" rel="noreferrer">
            Open
          </a>
        ) : null}
        <button className="linklike" type="button" onClick={() => onDelete(item.localId)} aria-label="Delete">
          Delete
        </button>
      </div>
    </li>
  );
}

// --- Settings ------------------------------------------------------------

function SettingsView({
  auth,
  plan,
  settings,
  onChange,
}: {
  auth: StoredAuth | null;
  plan: Plan;
  settings: ExtensionSettings;
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const cloudAllowed = canUseCloudSync(plan);

  async function toggleClose(checked: boolean) {
    await setSettings({ closeTabsAfterSending: checked });
    await onChange();
  }

  async function toggleCloud(checked: boolean) {
    setMsg(null);
    if (!checked) {
      await setSettings({ cloudSyncEnabled: false });
      await onChange();
      return;
    }
    // Enabling: ensure signed in, then confirm a paid plan, then backfill.
    let signedIn = auth;
    if (!signedIn) {
      try {
        signedIn = await signInWithRecallQ();
      } catch {
        return;
      }
    }
    const freshPlan = await getPlan(true);
    if (!canUseCloudSync(freshPlan)) {
      setMsg("Cloud sync requires a Starter or Pro plan.");
      await onChange();
      return;
    }
    await setSettings({ cloudSyncEnabled: true });
    await onChange();
    await doSync();
  }

  async function doSync() {
    setBusy(true);
    const res = await runSync();
    setBusy(false);
    if (res.ok) {
      setMsg(
        `Synced — ${res.pushed} up, ${res.pulled} down` +
          (res.pending ? `, ${res.pending} pending (monthly cloud limit)` : ""),
      );
    } else {
      setMsg(res.reason === "disabled" ? "Cloud sync is off." : "Sync failed.");
    }
    await onChange();
  }

  async function signOut() {
    await clearStoredAuth();
    await setSettings({ cloudSyncEnabled: false });
    await onChange();
  }

  return (
    <div className="settings">
      <label className="setting">
        <input
          type="checkbox"
          checked={settings.closeTabsAfterSending}
          onChange={(e) => void toggleClose(e.target.checked)}
        />
        <span>
          <strong>Close tabs after sending</strong>
          <small>When you send tabs to RecallQ, close them to clear the window.</small>
        </span>
      </label>

      <label className={`setting ${cloudAllowed || !auth ? "" : "disabled"}`}>
        <input
          type="checkbox"
          checked={settings.cloudSyncEnabled && cloudAllowed}
          onChange={(e) => void toggleCloud(e.target.checked)}
        />
        <span>
          <strong>Sync to cloud</strong>
          <small>
            Save your archive to RecallQ and sync it across your devices. Free saves stay
            unlimited and on-device; cloud sync needs a Starter or Pro plan.
          </small>
        </span>
      </label>

      {!cloudAllowed ? (
        <a className="upgrade" href={`${WEB_BASE_URL}/app/settings/billing`} target="_blank" rel="noreferrer">
          Upgrade to enable cloud sync →
        </a>
      ) : null}

      {settings.cloudSyncEnabled && cloudAllowed ? (
        <button className="secondary" type="button" disabled={busy} onClick={() => void doSync()}>
          {busy ? "Syncing…" : "Sync now"}
        </button>
      ) : null}

      {msg ? <div className="muted">{msg}</div> : null}

      <div className="plan-badge">
        {auth ? (
          <>
            Plan: <strong>{plan}</strong> ·{" "}
            <button className="linklike" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <>Not signed in — saving locally.</>
        )}
      </div>
    </div>
  );
}
