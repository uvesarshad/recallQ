import { apiError, apiOk } from "@/lib/api";
import { requireSessionUser } from "@/lib/request-auth";
import { MAX_QUERY_LENGTH, runSearch, type SearchMode } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") || "").trim();
  const mode = (searchParams.get("mode") || "hybrid") as SearchMode;

  if (!query) {
    return apiOk({ items: [], exact: [], semantic: [] });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return apiError(`Query too long (max ${MAX_QUERY_LENGTH} characters)`, 400);
  }

  const result = await runSearch(user.id, query, mode);
  return apiOk(result);
}
