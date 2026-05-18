import assert from "node:assert/strict";
import {
  canUserSave,
  canUseEmailIngest,
  getChatQueryLimit,
  getMaxReminders,
  getPlanLimits,
  PLAN_LIMITS,
} from "../lib/plan-limits.ts";

export function runPlanLimitsTests() {
  // getPlanLimits returns correct values per plan
  assert.equal(getPlanLimits("free").maxSavesPerMonth, 50);
  assert.equal(getPlanLimits("starter").maxSavesPerMonth, 100);
  assert.equal(getPlanLimits("pro").maxSavesPerMonth, Infinity);

  assert.equal(getPlanLimits("free").maxStorageBytes, 100 * 1024 * 1024);
  assert.equal(getPlanLimits("starter").maxStorageBytes, 1024 * 1024 * 1024);
  assert.equal(getPlanLimits("pro").maxStorageBytes, 10 * 1024 * 1024 * 1024);

  assert.equal(getPlanLimits("free").chatQueriesPerDay, 20);
  assert.equal(getPlanLimits("starter").chatQueriesPerDay, 50);
  assert.equal(getPlanLimits("pro").chatQueriesPerDay, Infinity);

  // canUserSave: true when under limit, false when at or above limit
  assert.equal(canUserSave("free", 0), true);
  assert.equal(canUserSave("free", 49), true);
  assert.equal(canUserSave("free", 50), false);
  assert.equal(canUserSave("free", 99), false);
  assert.equal(canUserSave("starter", 99), true);
  assert.equal(canUserSave("starter", 100), false);
  assert.equal(canUserSave("pro", 1_000_000), true);

  // canUseEmailIngest
  assert.equal(canUseEmailIngest("free"), false);
  assert.equal(canUseEmailIngest("starter"), true);
  assert.equal(canUseEmailIngest("pro"), true);

  // getChatQueryLimit
  assert.equal(getChatQueryLimit("free"), PLAN_LIMITS.free.chatQueriesPerDay);
  assert.equal(getChatQueryLimit("starter"), PLAN_LIMITS.starter.chatQueriesPerDay);
  assert.equal(getChatQueryLimit("pro"), Infinity);

  // getMaxReminders
  assert.equal(getMaxReminders("free"), PLAN_LIMITS.free.maxReminders);
  assert.equal(getMaxReminders("starter"), PLAN_LIMITS.starter.maxReminders);
  assert.equal(getMaxReminders("pro"), Infinity);
}
