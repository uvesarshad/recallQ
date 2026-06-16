// Reads the signed-in user's plan to gate cloud sync. All users save unlimited
// tabs locally for free; only saving to / syncing with the cloud is paid. The
// result is cached in `chrome.storage.session` with a short TTL so the
// stateless service worker doesn't hit `/me` on every save.
//
// The plan value is authoritative (from the server's `/api/v1/me`); the gate
// itself runs client-side (a free client simply won't push). The server is the
// real backstop — `ingestItem` still enforces plan save caps, so a tampered
// client can't actually write past the free tier. See `canUseCloudSync` in the
// web app's `lib/plan-limits.ts` for the canonical tier definition.

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

export function canUseCloudSync(plan: Plan): boolean {
  return plan !== "free";
}
