# Testing Infrastructure and Strategy

> Scope: Test harnesses, CLI execution commands, utility test cases, and coverage areas.
> Rendering context: N/A
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall includes a lightweight, built-in custom test harness to validate core utility helpers, ingestion processing, and search scoring algorithms without the overhead of heavy third-party testing frameworks. The test suite runs directly in Node.js, stripping TypeScript typings at runtime.

## Running Tests
- Test Command: Executed by running npm run test in the project root.
- Harness Script: Under the hood, this command executes tests/run-tests.ts using Node.js with the experimental strip types flag, which automatically parses and loads all TypeScript test files.
- Execution Flow: The runner reads the tests directory, discovers files ending with test.ts, executes each module in isolation, catches runtime assertions, and logs pass or fail results to the terminal before exiting.

## Test Suites Map

### Item Preview Test Suite
- File Location: tests/item-preview.test.ts
- Target Component: Validates preview URL resolution and extraction logic in lib/item-preview.ts.
- Focus Areas: Verifies that URLs are normalized properly, that metadata is resolved correctly from static patterns, and that error/null values are handled gracefully if URLs are malformed.

### Search Explainability Test Suite
- File Location: tests/search-explain.test.ts
- Target Component: Validates search ranking explanation helper in lib/search-explain.ts.
- Focus Areas: Tests similarity matching logic, exact phrase overlaps, and match reason labels. Ensures that when hybrid search returns a mix of exact and semantic results, each search card receives the correct explainability label (e.g. Exact Text Match or Highly Relevant) based on its score thresholds.

## Testing Guidelines
- AGENT AVOID: Do not introduce Jest, Mocha, or Vitest into the package dependencies unless explicitly requested by the user. Always leverage the lightweight tests/run-tests.ts runner.
- AGENT NOTE: When writing new utility helper files under lib/, always create a corresponding test file in tests/ ending in .test.ts, and register it in tests/run-tests.ts if manual import is required.

## Update Triggers
- When the CLI test script configuration in package.json is modified.
- When new test suites are added under the tests/ directory.
- When existing test files are renamed or testing requirements are updated.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Tech stack overview.
- [docs/infra/deployment.md](file:///e:/Projects/recallQ/docs/infra/deployment.md) — Deployment scripts.
- [docs/modules/search-chat-graph.md](file:///e:/Projects/recallQ/docs/modules/search-chat-graph.md) — Features validated by search tests.

AGENT OWNER: tests/run-tests.ts
AGENT UPDATE: docs/infra/testing.md
