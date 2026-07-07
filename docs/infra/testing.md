# Testing Infrastructure and Strategy

> Scope: Test harnesses, CLI commands, utility tests, and coverage areas.
> Rendering context: N/A
> Project tier: 4
> Last updated: 2026-07-07

## Overview
Recall uses a lightweight Node-based web test harness for focused utility coverage, plus TypeScript typechecks for app-level validation. Mobile uses the Expo app's `tsc --noEmit` script.

## Running Tests
- Web tests: from `apps/web`, run `npm run test -- --run`.
- Web typecheck: from `apps/web`, run `npm run typecheck`.
- Mobile typecheck: from the workspace root, run `pnpm --dir apps/mobile typecheck`.
- Harness script: `apps/web/tests/run-tests.ts` imports each focused test suite and exits non-zero on assertion failure.

## Test Suites Map

### Item Preview Test Suite
- File: `apps/web/tests/item-preview.test.ts`
- Target: `apps/web/lib/item-preview.ts`
- Coverage: URL normalization, static metadata extraction, malformed URL handling.

### Search Explainability Test Suite
- File: `apps/web/tests/search-explain.test.ts`
- Target: `apps/web/lib/search-explain.ts`
- Coverage: exact phrase overlaps, term matches, similarity labels, and reason text.

### Relations Test Suite
- File: `apps/web/tests/relations.test.ts`
- Target: `apps/web/lib/relations.ts`
- Coverage: relation pair ordering, strength clamping, and hostname extraction.

### Plan Limits Test Suite
- File: `apps/web/tests/plan-limits.test.ts`
- Target: `apps/web/lib/plan-limits.ts`
- Coverage: plan caps, self-host bypass behavior, and cloud-sync entitlement helpers.

### Comment Actions Test Suite
- File: `apps/web/tests/comment-actions.test.ts`
- Target: `apps/web/lib/comment-actions.ts`
- Coverage: tag extraction, reminder parsing, folder/category parsing, and intent signal behavior.

### URL Safety Test Suite
- File: `apps/web/tests/url-safety.test.ts`
- Target: `apps/web/lib/url-safety.ts`
- Coverage: blocking local/private/link-local/reserved IPs, localhost names, non-HTTP protocols, embedded credentials, and allowing public HTTP/HTTPS URLs.

## Testing Guidelines
- AGENT AVOID: Do not introduce Jest, Mocha, or Vitest unless explicitly requested.
- AGENT NOTE: New focused helpers under `apps/web/lib/` should have a matching `apps/web/tests/*.test.ts` file registered in `run-tests.ts`.

## Update Triggers
- When test scripts change.
- When test suites are added, renamed, or removed.
- When new testing requirements are introduced.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) - Tech stack overview.
- [docs/infra/deployment.md](file:///e:/Projects/recallQ/docs/infra/deployment.md) - Runtime commands.
- [docs/modules/search-chat-canvas.md](file:///e:/Projects/recallQ/docs/modules/search-chat-canvas.md) - Search features validated by tests.

AGENT OWNER: apps/web/tests/run-tests.ts
AGENT UPDATE: docs/infra/testing.md
