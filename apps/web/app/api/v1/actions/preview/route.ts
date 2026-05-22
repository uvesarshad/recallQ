import { apiError, apiOk } from "@/lib/api";
import { previewCaptureActions } from "@/lib/comment-actions";
import { rateLimit } from "@/lib/rate-limit";
import { requireSessionUser } from "@/lib/request-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const previewSchema = z.object({
  text: z.string().trim().min(1).max(5000),
});

export async function POST(req: Request) {
  const user = await requireSessionUser();
  if (!user) {
    return apiError("Unauthorized", 401);
  }

  // Every call hits Gemini, so this is a real cost surface. 60/hour is
  // generous for interactive previewing while a typing user types `comment:
  // remind me`-style commands.
  const burst = await rateLimit({
    key: `actions-preview:user:${user.id}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (!burst.allowed) {
    return apiError("Too many preview requests. Wait a few minutes and try again.", 429);
  }

  const body = previewSchema.parse(await req.json());
  const preview = await previewCaptureActions(body.text);
  return apiOk({ preview });
}
