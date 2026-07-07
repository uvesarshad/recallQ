import { runArchiveAssetsTests } from "./archive-assets.test.ts";
import { runCommentActionsTests } from "./comment-actions.test.ts";
import { runEnrichmentClaimTests } from "./enrichment-claim.test.ts";
import { runIngestLimitsTests } from "./ingest-limits.test.ts";
import { runImportExportTests } from "./import-export.test.ts";
import { runItemPreviewTests } from "./item-preview.test.ts";
import { runPlanLimitsTests } from "./plan-limits.test.ts";
import { runReaderStateTests } from "./reader-state.test.ts";
import { runRelationsTests } from "./relations.test.ts";
import { runRssTests } from "./rss.test.ts";
import { runSearchExplainTests } from "./search-explain.test.ts";
import { runSearchParserTests } from "./search-parser.test.ts";
import { runUrlSafetyTests } from "./url-safety.test.ts";

async function main() {
  runArchiveAssetsTests();
  runSearchExplainTests();
  runSearchParserTests();
  runItemPreviewTests();
  runPlanLimitsTests();
  runReaderStateTests();
  runRelationsTests();
  await runRssTests();
  runImportExportTests();
  runCommentActionsTests();
  runUrlSafetyTests();
  await runIngestLimitsTests();
  await runEnrichmentClaimTests();
  process.stdout.write("Tests passed\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
