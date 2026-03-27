export type Plan = "free" | "starter" | "pro";

export const PLAN_LIMITS = {
  free: {
    maxSavesPerMonth: 50,
    maxFileUploadSizeMB: 10,
    maxReminders: 2,
    emailIngest: false,
    chatQueriesPerDay: 20,
  },
  starter: {
    maxSavesPerMonth: 100,
    maxFileUploadSizeMB: 10,
    maxReminders: 30,
    emailIngest: true,
    chatQueriesPerDay: 50,
  },
  pro: {
    maxSavesPerMonth: Infinity,
    maxFileUploadSizeMB: 50,
    maxReminders: Infinity,
    emailIngest: true,
    chatQueriesPerDay: Infinity,
  },
};

export function canUserSave(plan: Plan, savesThisMonth: number) {
  return savesThisMonth < PLAN_LIMITS[plan].maxSavesPerMonth;
}
