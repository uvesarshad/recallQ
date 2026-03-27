"use client";

import { useEffect, useState } from "react";
import { Shield, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfileSettingsClient() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    void fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setProfile(data.user))
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile() {
    const confirmed = window.confirm("Delete your Recall profile? This removes all saved items and comments.");
    if (!confirmed) return;
    await fetch("/api/me", { method: "DELETE" });
    window.location.href = "/";
  }

  if (loading || !profile) {
    return <div className="rounded-modals border border-border bg-surface p-6 text-sm text-text-muted">Loading profile...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-modals border border-border bg-surface p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-full bg-brand/10 p-2 text-brand">
            <UserRound className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Profile details</h1>
            <p className="text-sm text-text-muted">Update your public account details and default timezone.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={profile.name || ""}
            onChange={(e) => setProfile((current: any) => ({ ...current, name: e.target.value }))}
            placeholder="Name"
            className="rounded-input border border-border bg-bg px-4 py-3 text-sm outline-none focus:border-brand"
          />
          <input value={profile.email || ""} disabled className="rounded-input border border-border bg-bg px-4 py-3 text-sm text-text-muted" />
          <input
            value={profile.timezone || ""}
            onChange={(e) => setProfile((current: any) => ({ ...current, timezone: e.target.value }))}
            placeholder="Timezone"
            className="rounded-input border border-border bg-bg px-4 py-3 text-sm outline-none focus:border-brand"
          />
          <input value={profile.plan || ""} disabled className="rounded-input border border-border bg-bg px-4 py-3 text-sm text-text-muted" />
        </div>
        <textarea
          value={profile.bio || ""}
          onChange={(e) => setProfile((current: any) => ({ ...current, bio: e.target.value }))}
          rows={4}
          placeholder="Short bio"
          className="mt-4 w-full rounded-input border border-border bg-bg px-4 py-3 text-sm outline-none focus:border-brand"
        />
        <div className="mt-4 flex justify-end">
          <button onClick={saveProfile} disabled={saving} className="rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white">
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </section>

      <section className="rounded-modals border border-border bg-surface p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-full bg-brand/10 p-2 text-brand">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Password and security</h2>
            <p className="text-sm text-text-muted">This build uses Google OAuth and magic links. There is no local password to rotate.</p>
          </div>
        </div>
        <div className="rounded-cards border border-border bg-bg p-4 text-sm text-text-muted">
          Use your identity provider settings for password changes and MFA. Theme, chat history, and sidebar preferences remain local to this browser.
        </div>
      </section>

      <section className="rounded-modals border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary">Consent</h2>
        <div className="mt-4 space-y-3">
          <label className="flex items-center justify-between rounded-cards border border-border bg-bg px-4 py-3">
            <span className="text-sm text-text-primary">Product updates</span>
            <input
              type="checkbox"
              checked={!!profile.marketing_consent}
              onChange={(e) => setProfile((current: any) => ({ ...current, marketing_consent: e.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between rounded-cards border border-border bg-bg px-4 py-3">
            <span className="text-sm text-text-primary">Usage analytics</span>
            <input
              type="checkbox"
              checked={!!profile.analytics_consent}
              onChange={(e) => setProfile((current: any) => ({ ...current, analytics_consent: e.target.checked }))}
            />
          </label>
        </div>
      </section>

      <section className="rounded-modals border border-red-500/30 bg-red-500/5 p-6">
        <div className="mb-4 flex items-center gap-3">
          <Trash2 className="h-5 w-5 text-red-500" />
          <h2 className="text-lg font-semibold text-text-primary">Delete profile</h2>
        </div>
        <p className="text-sm text-text-muted">This permanently deletes your account and all associated Recall data.</p>
        <button onClick={deleteProfile} className="mt-4 rounded-buttons bg-red-600 px-4 py-2 text-sm font-medium text-white">
          Delete profile
        </button>
      </section>
    </div>
  );
}
