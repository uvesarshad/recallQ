import { apiError, apiOk } from "@/lib/api";
import { previewCaptureActions } from "@/lib/comment-actions";
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

  const body = previewSchema.parse(await req.json());
  const preview = await previewCaptureActions(body.text);
  return apiOk({ preview });
}
