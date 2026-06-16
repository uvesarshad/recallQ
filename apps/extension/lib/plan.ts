// Reads the signed-in user's plan for client-side entitlement gating (settings
// sync). Result is cached in `chrome.storage.session` with a short TTL so the
// stateless service worker doesn't hit `/me` on every menu interaction.
//
// This is a CLIENT-SIDE entitlement only — the synced data lives in the user's
// own Google account (chrome.storage.sync), not RecallQ servers, so there's no
// server cost to gate. The plan value itself is authoritative (it comes from
// the server's `/api/v1/me`). See `canUseDeviceSync` in the web app's
// `lib/plan-limits.ts` for the canonical tier definition.

import { apiClient } from "./client";

export type Plan = "free" | "starter" | "pro";

const PLAN_CACHE_KEY = "recallq.plan.cache";
const TTL_MS = 5 * 60 * 1000;

type PlanCache = { plan: Plan; at: number };

export async function getPlan(force = false): Promise<Plan> {
  if (!force) {
    const cached = await chrome.storage.session.get(PLAN_CACHE_KEY);
    const entry = cached[PLAN_CACHE_KEY] as PlanCache | undefined;
    if (entry && Date.now() - entry.at < TTL_MS) {
      return entry.plan;
    }
  }
  try {
    const me = await apiClient.me.get();
    const plan = (me.user?.plan ?? "free") as Plan;
    await chrome.storage.session.set({
      [PLAN_CACHE_KEY]: { plan, at: Date.now() } satisfies PlanCache,
    });
    return plan;
  } catch {
    // Network/auth failure — fail closed to the free tier.
    return "free";
  }
}

export function canSyncSettings(plan: Plan): boolean {
  return plan !== "free";
}
