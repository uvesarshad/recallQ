import { apiError, apiOk } from "@/lib/api";
import { requireSessionUser } from "@/lib/request-auth";
import { MAX_QUERY_LENGTH, MAX_RESULT_LIMIT, runSearch, type SearchMode } from "@/lib/search";

export const dynamic = "force-dynamic";

const SEARCH_MODES = new Set<SearchMode>(["hybrid", "fulltext", "semantic"]);

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") || "").trim();
  const requestedMode = (searchParams.get("mode") || "hybrid") as SearchMode;
  const mode = SEARCH_MODES.has(requestedMode) ? requestedMode : "hybrid";
  const cursor = searchParams.get("cursor");
  const parsedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_RESULT_LIMIT)
    : 20;

  if (!query) {
    return apiOk({ items: [], exact: [], semantic: [], nextCursor: null, hasMore: false });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return apiError(`Query too long (max ${MAX_QUERY_LENGTH} characters)`, 400);
  }

  const result = await runSearch(user.id, query, mode, { limit, cursor });
  return apiOk(result);
}
