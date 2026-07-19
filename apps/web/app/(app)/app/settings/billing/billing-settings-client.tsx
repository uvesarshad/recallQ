"use client";

import React, { useEffect, useState } from "react";
import { T, FONT } from "@recall/tokens";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

type UsageStats = {
  saves_this_month: number;
  max_saves_per_month: number;
  storage_used_bytes: number;
  max_storage_bytes: number;
  chat_queries_today: number;
  chat_queries_reset_date: string | null;
  max_chat_queries_per_day: number;
};

type BillingProvider = "razorpay" | "stripe";

type ProfileResponse = {
  user: {
    name?: string | null;
    email?: string | null;
    plan: "free" | "starter" | "pro";
    subscription_plan?: "starter" | "pro" | null;
    subscription_status?: string | null;
    subscription_current_start?: string | null;
    subscription_current_end?: string | null;
    subscription_cancel_at_cycle_end?: boolean | null;
    razorpay_subscription_id?: string | null;
    stripe_subscription_id?: string | null;
    stripe_customer_id?: string | null;
    billing_provider?: BillingProvider | null;
  } | null;
  billing: {
    enabled: boolean;
    selfHosted: boolean;
    providers?: {
      razorpay: boolean;
      stripe: boolean;
    };
  };
  usage?: UsageStats | null;
};

const planCards = [
  {
    id: "free",
    title: "Free",
    price: "Free",
    features: ["50 saves/month", "100 MB file storage", "20 chat queries/day", "2 active reminders"],
  },
  {
    id: "starter",
    title: "Starter",
    price: "$29/year",
    features: ["100 saves/month", "1 GB file storage", "50 chat queries/day", "30 active reminders", "Email forwarding"],
  },
  {
    id: "pro",
    title: "Pro",
    price: "$99/year",
    features: ["Unlimited saves", "10 GB file storage", "Unlimited chat queries", "Unlimited reminders", "Email forwarding"],
  },
] as const;

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function UsageMeter({ label, used, max, unit }: { label: string; used: number; max: number; unit?: string }) {
  const isUnlimited = !isFinite(max);
  const pct = isUnlimited ? 0 : Math.min(100, (used / max) * 100);
  const displayUsed = unit === "bytes" ? formatBytes(used) : used.toLocaleString();
  const displayMax = isUnlimited ? "∞" : unit === "bytes" ? formatBytes(max) : max.toLocaleString();

  return (
    <div style={{
      borderRadius: 14,
      border: "1px solid " + T.line,
      background: "rgba(255,255,255,0.5)",
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</span>
        <span style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: T.ink }}>
          {displayUsed} / {displayMax}
        </span>
      </div>
      {!isUnlimited && (
        <div style={{ marginTop: 8, height: 5, width: "100%", overflow: "hidden", borderRadius: 99, background: T.line }}>
          <div
            style={{
              height: "100%",
              borderRadius: 99,
              transition: "width 0.3s",
              background: pct >= 90
                ? "#EF4444"
                : pct >= 70
                  ? "#F59E0B"
                  : "linear-gradient(90deg, " + T.azure + ", " + T.mint + ")",
              width: `${pct}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}

async function ensureRazorpayScript() {
  if (window.Razorpay) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

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

export default function BillingSettingsClient() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferredProvider, setPreferredProvider] = useState<BillingProvider>("razorpay");

  async function loadProfile() {
    setLoading(true);
    const res = await fetch("/api/me");
    const data = (await res.json()) as ProfileResponse;
    setProfile(data);
    const providers = data.billing.providers;
    if (providers) {
      if (providers.stripe) setPreferredProvider("stripe");
      else if (providers.razorpay) setPreferredProvider("razorpay");
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function startRazorpayCheckout(plan: "starter" | "pro") {
    const res = await fetch("/api/payments/create-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to start Razorpay checkout");

    await ensureRazorpayScript();
    if (!window.Razorpay) throw new Error("Razorpay checkout is unavailable");

    const instance = new window.Razorpay({
      key: data.key,
      subscription_id: data.subscriptionId,
      name: "RecallQ",
      description: `${data.planLabel} annual subscription`,
      handler: async () => {
        await loadProfile();
      },
      prefill: {
        name: profile?.user?.name || "",
        email: profile?.user?.email || "",
      },
      theme: { color: "#6366f1" },
    });
    instance.open();
  }

  async function startStripeCheckout(plan: "starter" | "pro") {
    const res = await fetch("/api/payments/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to start Stripe checkout");
    if (!data.url) throw new Error("Stripe did not return a checkout URL");
    window.location.assign(data.url as string);
  }

  async function startCheckout(plan: "starter" | "pro") {
    setError(null);
    setSubmittingPlan(plan);
    try {
      if (preferredProvider === "stripe") {
        await startStripeCheckout(plan);
      } else {
        await startRazorpayCheckout(plan);
      }
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Failed to start checkout");
    } finally {
      setSubmittingPlan(null);
    }
  }

  async function cancelSubscription() {
    setError(null);
    setCancelling(true);

    try {
      const res = await fetch("/api/payments/cancel-subscription", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel subscription");
      await loadProfile();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  }

  async function openStripePortal() {
    setError(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/payments/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open portal");
      if (!data.url) throw new Error("Stripe did not return a portal URL");
      window.location.assign(data.url as string);
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Failed to open portal");
      setPortalLoading(false);
    }
  }

  if (loading || !profile?.user) {
    return (
      <div style={{ ...glassCard, padding: "24px 18px", fontFamily: FONT, fontSize: 14, color: T.inkFaint }}>
        Loading billing...
      </div>
    );
  }

  if (profile.billing.selfHosted) {
    return (
      <div style={{ maxWidth: 620, margin: "0 auto", paddingBottom: 60 }}>
        <h1 style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color: T.ink, margin: "8px 0 4px" }}>Billing</h1>
        <div style={glassCard}>
          <div style={{ padding: "24px 18px", fontFamily: FONT, fontSize: 14, color: T.inkSoft }}>
            This deployment is running in self-hosted mode. Paid plans and hosted usage limits are disabled here.
          </div>
        </div>
      </div>
    );
  }

  const user = profile.user;
  const usage = profile.usage;
  const currentPlan = user.plan;
  const currentEnd = formatDate(user.subscription_current_end);
  const hasPaidSubscription = currentPlan !== "free";
  const providers = profile.billing.providers ?? { razorpay: true, stripe: false };
  const bothProvidersAvailable = providers.razorpay && providers.stripe;
  const subscribedProvider: BillingProvider | null =
    user.billing_provider ??
    (user.stripe_subscription_id ? "stripe" : user.razorpay_subscription_id ? "razorpay" : null);

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", paddingBottom: 60 }}>
      <h1 style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color: T.ink, margin: "8px 0 4px" }}>
        Billing
      </h1>
      <p style={{ fontFamily: FONT, fontSize: 14, color: T.inkSoft, margin: "0 0 22px" }}>
        Manage your subscription and review usage.
      </p>

      {/* Usage */}
      {usage && (
        <div style={glassCard}>
          <div style={sectionLabel}>Usage this period</div>
          <div style={{ padding: "18px", display: "grid", gap: 12, gridTemplateColumns: "repeat(3, 1fr)" }}>
            <UsageMeter label="Saves this month" used={usage.saves_this_month} max={usage.max_saves_per_month} />
            <UsageMeter label="Storage used" used={usage.storage_used_bytes} max={usage.max_storage_bytes} unit="bytes" />
            <UsageMeter label="Chat queries today" used={usage.chat_queries_today} max={usage.max_chat_queries_per_day} />
          </div>
        </div>
      )}

      {/* Annual plans */}
      <div style={glassCard}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "14px 18px", borderBottom: "1px solid " + T.line }}>
          <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: ".6px" }}>
            Annual plans
          </div>
          {bothProvidersAvailable && !hasPaidSubscription ? (
            <div
              role="group"
              aria-label="Choose billing provider"
              style={{ display: "inline-flex", borderRadius: 10, border: "1px solid " + T.line, background: "rgba(255,255,255,0.5)", padding: 3, gap: 2 }}
            >
              <button
                type="button"
                aria-pressed={preferredProvider === "stripe"}
                onClick={() => setPreferredProvider("stripe")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "none",
                  fontFamily: FONT,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: preferredProvider === "stripe" ? "linear-gradient(120deg," + T.azure + "," + T.mint + ")" : "transparent",
                  color: preferredProvider === "stripe" ? "#fff" : T.inkSoft,
                  transition: "background var(--duration-base) var(--ease-out), color var(--duration-base) var(--ease-out)",
                }}
              >
                Pay with Stripe
              </button>
              <button
                type="button"
                aria-pressed={preferredProvider === "razorpay"}
                onClick={() => setPreferredProvider("razorpay")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "none",
                  fontFamily: FONT,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: preferredProvider === "razorpay" ? "linear-gradient(120deg," + T.azure + "," + T.mint + ")" : "transparent",
                  color: preferredProvider === "razorpay" ? "#fff" : T.inkSoft,
                  transition: "background var(--duration-base) var(--ease-out), color var(--duration-base) var(--ease-out)",
                }}
              >
                Pay with Razorpay
              </button>
            </div>
          ) : null}
        </div>

        <div style={{ padding: "18px", display: "grid", gap: 12, gridTemplateColumns: "repeat(3, 1fr)" }}>
          {planCards.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isPaidPlan = plan.id === "starter" || plan.id === "pro";
            const disabled =
              !!submittingPlan ||
              (isCurrent && plan.id !== "free") ||
              (hasPaidSubscription && !isCurrent);

            const ctaLabel = isCurrent
              ? "Current plan"
              : submittingPlan === plan.id
                ? preferredProvider === "stripe" ? "Opening Stripe..." : "Opening Razorpay..."
                : `Choose ${plan.title}`;

            return (
              <div
                key={plan.id}
                style={{
                  borderRadius: 14,
                  border: isCurrent ? "1.5px solid " + T.azure : "1.5px solid " + T.line,
                  background: isCurrent ? "rgba(61,125,255,0.06)" : "rgba(255,255,255,0.45)",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: T.ink }}>{plan.title}</div>
                    <div style={{ fontFamily: FONT, fontSize: 13, color: T.inkSoft, marginTop: 2 }}>{plan.price}</div>
                  </div>
                  {isCurrent ? (
                    <span style={{ padding: "2px 8px", borderRadius: 99, background: "linear-gradient(120deg," + T.azure + "," + T.mint + ")", fontFamily: FONT, fontSize: 10, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: ".5px", whiteSpace: "nowrap" }}>
                      Current
                    </span>
                  ) : null}
                </div>
                <ul style={{ marginTop: 12, marginBottom: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  {plan.features.map((feature) => (
                    <li key={feature} style={{ fontFamily: FONT, fontSize: 12.5, color: T.inkSoft, paddingLeft: 0 }}>
                      {feature}
                    </li>
                  ))}
                </ul>
                {isPaidPlan ? (
                  <button
                    onClick={() => startCheckout(plan.id)}
                    disabled={disabled}
                    style={{
                      marginTop: 14,
                      width: "100%",
                      padding: "9px 0",
                      borderRadius: 10,
                      border: "none",
                      background: disabled
                        ? "rgba(11,18,32,0.08)"
                        : "linear-gradient(120deg," + T.azure + "," + T.mint + ")",
                      color: disabled ? T.inkFaint : "#fff",
                      fontFamily: FONT,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: disabled ? "not-allowed" : "pointer",
                      transition: "background var(--duration-base) var(--ease-out), color var(--duration-base) var(--ease-out)",
                    }}
                  >
                    {ctaLabel}
                  </button>
                ) : (
                  <div style={{ marginTop: 14, padding: "9px 0", textAlign: "center", fontFamily: FONT, fontSize: 13, color: T.inkFaint }}>
                    Free tier
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!hasPaidSubscription && bothProvidersAvailable ? (
          <div style={{ padding: "0 18px 18px", fontFamily: FONT, fontSize: 12, color: T.inkFaint }}>
            Stripe accepts most international cards and offers a self-service portal for upgrades / invoices. Razorpay is the better fit for users in India (UPI, NetBanking).
          </div>
        ) : null}
      </div>

      {/* Subscription status */}
      <div style={glassCard}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid " + T.line }}>
          <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: ".6px" }}>
            Subscription status
          </div>
          {subscribedProvider ? (
            <span style={{ padding: "2px 8px", borderRadius: 99, border: "1px solid " + T.line, background: "rgba(255,255,255,0.5)", fontFamily: FONT, fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: ".5px" }}>
              via {subscribedProvider}
            </span>
          ) : null}
        </div>

        <div style={{ padding: "18px", display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          {[
            { label: "Plan", value: currentPlan },
            { label: "Status", value: user.subscription_status || "free" },
            { label: "Current period ends", value: currentEnd || "Not applicable" },
            { label: "Cancellation", value: user.subscription_cancel_at_cycle_end ? "Scheduled at period end" : "Active" },
          ].map(({ label, value }) => (
            <div key={label} style={{ borderRadius: 12, border: "1px solid " + T.line, background: "rgba(255,255,255,0.45)", padding: "12px 14px" }}>
              <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
              <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: T.ink, marginTop: 6 }}>{value}</div>
            </div>
          ))}
        </div>

        {hasPaidSubscription ? (
          <div style={{ padding: "0 18px 18px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {subscribedProvider === "stripe" ? (
              <>
                <button
                  onClick={openStripePortal}
                  disabled={portalLoading}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 10,
                    border: "none",
                    background: portalLoading ? "rgba(11,18,32,0.08)" : "linear-gradient(120deg," + T.azure + "," + T.mint + ")",
                    color: portalLoading ? T.inkFaint : "#fff",
                    fontFamily: FONT,
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: portalLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {portalLoading ? "Opening portal..." : "Manage subscription"}
                </button>
                <p style={{ width: "100%", fontFamily: FONT, fontSize: 12, color: T.inkFaint, margin: "4px 0 0" }}>
                  Update your card, view invoices, switch plans, or cancel from Stripe&apos;s hosted portal.
                </p>
              </>
            ) : (
              <button
                onClick={cancelSubscription}
                disabled={cancelling}
                style={{
                  padding: "9px 20px",
                  borderRadius: 10,
                  border: "1px solid " + T.line,
                  background: "transparent",
                  color: T.ink,
                  fontFamily: FONT,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: cancelling ? "not-allowed" : "pointer",
                  opacity: cancelling ? 0.6 : 1,
                }}
              >
                {cancelling ? "Cancelling..." : "Cancel at period end"}
              </button>
            )}
          </div>
        ) : null}

        {error ? (
          <div style={{ margin: "0 18px 18px", fontFamily: FONT, fontSize: 13, color: "#EF4444" }}>
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
