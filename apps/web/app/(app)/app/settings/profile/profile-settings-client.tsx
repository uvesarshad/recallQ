"use client";

import React, { useEffect, useState } from "react";
import { Shield, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ProfileRecord } from "@/lib/types";
import { T, FONT } from "@recall/tokens";

const glassCard: React.CSSProperties = {
  borderRadius: 20,
  overflow: "hidden",
  background: "rgba(255,255,255,.62)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid " + T.glassEdge,
  boxShadow: T.shadowSoft,
  marginBottom: 18,
};

const sectionLabel: React.CSSProperties = {
  padding: "14px 18px",
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 700,
  color: T.inkFaint,
  textTransform: "uppercase",
  letterSpacing: ".6px",
  borderBottom: "1px solid " + T.line,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid " + T.line,
  background: "rgba(255,255,255,0.7)",
  fontFamily: FONT,
  fontSize: 14,
  color: T.ink,
  outline: "none",
  boxSizing: "border-box",
};

const inputDisabledStyle: React.CSSProperties = {
  ...inputStyle,
  color: T.inkFaint,
  background: "rgba(255,255,255,0.4)",
};

export default function ProfileSettingsClient() {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletePending, setDeletePending] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    void fetch("/api/me")
      .then((res) => res.json())
      .then((data: { user?: ProfileRecord | null }) => setProfile(data.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  function updateProfile(patch: Partial<ProfileRecord>) {
    setProfile((current) => (current ? { ...current, ...patch } : current));
  }

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
    await fetch("/api/me", { method: "DELETE" });
    window.location.href = "/";
  }

  if (loading || !profile) {
    return (
      <div style={{ ...glassCard, padding: "24px 18px", fontFamily: FONT, fontSize: 14, color: T.inkFaint }}>
        Loading profile...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", paddingBottom: 60 }}>
      <h1 style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color: T.ink, margin: "8px 0 4px" }}>
        Profile
      </h1>
      <p style={{ fontFamily: FONT, fontSize: 14, color: T.inkSoft, margin: "0 0 22px" }}>
        Update your account details and preferences.
      </p>

      {/* Profile details */}
      <div style={glassCard}>
        <div style={sectionLabel}>Profile details</div>
        <div style={{ padding: "18px 18px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(61,125,255,.1)", flexShrink: 0 }}>
              <UserRound size={18} color={T.azure} />
            </div>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: T.ink }}>Account information</div>
              <div style={{ fontFamily: FONT, fontSize: 12.5, color: T.inkSoft }}>Update your public account details and default timezone.</div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
            <input
              value={profile.name || ""}
              onChange={(e) => updateProfile({ name: e.target.value })}
              placeholder="Name"
              aria-label="Display name"
              style={inputStyle}
            />
            <input
              value={profile.email || ""}
              disabled
              aria-label="Email address (read-only)"
              style={inputDisabledStyle}
            />
            <input
              value={profile.timezone || ""}
              onChange={(e) => updateProfile({ timezone: e.target.value })}
              placeholder="Timezone"
              aria-label="Timezone"
              style={inputStyle}
            />
            <input
              value={profile.plan || ""}
              disabled
              aria-label="Plan (read-only)"
              style={inputDisabledStyle}
            />
          </div>
          <textarea
            value={profile.bio || ""}
            onChange={(e) => updateProfile({ bio: e.target.value })}
            rows={4}
            placeholder="Short bio"
            aria-label="Bio"
            style={{ ...inputStyle, resize: "vertical", marginBottom: 12 }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 18px 18px" }}>
          <button
            onClick={saveProfile}
            disabled={saving}
            style={{
              padding: "9px 20px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(120deg, " + T.azure + ", " + T.mint + ")",
              color: "#fff",
              fontFamily: FONT,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
              boxShadow: "0 2px 8px rgba(61,125,255,0.25)",
            }}
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>

      {/* Password and security */}
      <div style={glassCard}>
        <div style={sectionLabel}>Password and security</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px" }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(61,125,255,.1)", flexShrink: 0 }}>
            <Shield size={18} color={T.azure} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: T.ink }}>Authentication</div>
            <div style={{ fontFamily: FONT, fontSize: 12.5, color: T.inkSoft }}>This build supports Google OAuth and email/password sign-in.</div>
          </div>
        </div>
        <div style={{ margin: "0 18px 18px", padding: "12px 14px", borderRadius: 10, background: "rgba(11,18,32,0.03)", border: "1px solid " + T.line, fontFamily: FONT, fontSize: 13, color: T.inkSoft }}>
          Password rotation is not exposed in settings yet. Use your Google account settings for OAuth security. Theme, chat history, and sidebar preferences remain local to this browser.
        </div>
      </div>

      {/* Consent */}
      <div style={glassCard}>
        <div style={sectionLabel}>Consent</div>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid " + T.line, cursor: "pointer" }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: T.ink }}>Product updates</div>
            <div style={{ fontFamily: FONT, fontSize: 12.5, color: T.inkSoft }}>Receive product news and feature announcements.</div>
          </div>
          <input
            type="checkbox"
            checked={!!profile.marketing_consent}
            onChange={(e) => updateProfile({ marketing_consent: e.target.checked })}
            style={{ width: 16, height: 16, accentColor: T.azure, flexShrink: 0 }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer" }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: T.ink }}>Usage analytics</div>
            <div style={{ fontFamily: FONT, fontSize: 12.5, color: T.inkSoft }}>Help us improve with anonymised usage data.</div>
          </div>
          <input
            type="checkbox"
            checked={!!profile.analytics_consent}
            onChange={(e) => updateProfile({ analytics_consent: e.target.checked })}
            style={{ width: 16, height: 16, accentColor: T.azure, flexShrink: 0 }}
          />
        </label>
      </div>

      {/* Delete profile */}
      <div style={{
        borderRadius: 20,
        overflow: "hidden",
        background: "rgba(255,245,245,0.7)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(220,50,50,0.18)",
        boxShadow: T.shadowSoft,
        marginBottom: 18,
      }}>
        <div style={{ ...sectionLabel, color: "#C03030", borderBottom: "1px solid rgba(220,50,50,0.12)" }}>Danger zone</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px" }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(220,50,50,0.1)", flexShrink: 0 }}>
            <Trash2 size={18} color="#C03030" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: T.ink }}>Delete profile</div>
            <div style={{ fontFamily: FONT, fontSize: 12.5, color: T.inkSoft }}>This permanently deletes your account and all associated Recall data.</div>
            {deletePending ? (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(220,50,50,0.08)", border: "1px solid rgba(220,50,50,0.2)" }}>
                <span style={{ flex: 1, fontFamily: FONT, fontSize: 13, color: "#C03030" }}>This cannot be undone. Delete your account permanently?</span>
                <button
                  onClick={() => setDeletePending(false)}
                  style={{ fontFamily: FONT, fontSize: 13, color: T.inkSoft, background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
                >
                  Cancel
                </button>
                <button
                  onClick={deleteProfile}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#C03030", color: "#fff", fontFamily: FONT, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  Delete
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeletePending(true)}
                style={{ marginTop: 10, padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(192,48,48,0.35)", background: "transparent", color: "#C03030", fontFamily: FONT, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
              >
                Delete profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
