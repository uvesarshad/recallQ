import { runCommentActionsTests } from "./comment-actions.test.ts";
import { runItemPreviewTests } from "./item-preview.test.ts";
import { runPlanLimitsTests } from "./plan-limits.test.ts";
import { runRelationsTests } from "./relations.test.ts";
import { runSearchExplainTests } from "./search-explain.test.ts";
import { runUrlSafetyTests } from "./url-safety.test.ts";

function main() {
  runSearchExplainTests();
  runItemPreviewTests();
  runPlanLimitsTests();
  runRelationsTests();
  runCommentActionsTests();
  runUrlSafetyTests();
  process.stdout.write("Tests passed\n");
}

main();
