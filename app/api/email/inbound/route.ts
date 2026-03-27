import { apiError, apiOk } from "@/lib/api";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ingestItem } from "@/lib/ingest";
import { emailInboundSchema } from "@/lib/validation";
import { Resend } from "resend";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

function normalizeInboundPayload(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "type" in payload &&
    payload.type === "email.received" &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object"
  ) {
    const data = payload.data as Record<string, unknown>;
    return {
      from: data.from,
      to: Array.isArray(data.to) ? data.to[0] : data.to,
      subject: data.subject,
      text: data.text,
      html: data.html,
      attachments: data.attachments,
    };
  }

  return payload;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  let parsedBody: unknown;

  try {
    if (env.RESEND_WEBHOOK_SECRET && resend) {
      parsedBody = resend.webhooks.verify({
        payload: rawBody,
        webhookSecret: env.RESEND_WEBHOOK_SECRET,
        headers: {
          id: req.headers.get("svix-id") ?? "",
          timestamp: req.headers.get("svix-timestamp") ?? "",
          signature: req.headers.get("svix-signature") ?? "",
        },
      });
    } else {
      if (env.RESEND_INBOUND_SECRET) {
        const signature = req.headers.get("x-resend-signature") ?? req.headers.get("authorization");
        if (
          signature !== env.RESEND_INBOUND_SECRET &&
          signature !== `Bearer ${env.RESEND_INBOUND_SECRET}`
        ) {
          return apiError("Unauthorized", 401);
        }
      }

      parsedBody = JSON.parse(rawBody);
    }
  } catch (error) {
    console.error("Failed to verify inbound email webhook", error);
    return apiError("Unauthorized", 401);
  }

  const body = emailInboundSchema.parse(normalizeInboundPayload(parsedBody));
  const to = Array.isArray(body.to) ? body.to[0] : body.to;
  const { from, subject, text, html, attachments } = body;

  if (!to) {
    return apiError("Missing recipient", 400);
  }

  // Find user by inbound email address
  const userResult = await db.query(
    "SELECT id, plan FROM users WHERE inbound_email_address = $1",
    [to]
  );

  if (userResult.rowCount === 0) {
    return apiOk({ ok: true });
  }

  const user = userResult.rows[0];

  // Enforce plan gating: Free plan cannot use email capture
  if (user.plan === "free") {
    return apiError("Email capture not available on free plan", 402);
  }

  const result = await ingestItem({
    userId: user.id,
    type: "note", // Email is usually treated as a note/text
    raw_text: text || html,
    capture_note: subject,
    source: "email",
  });

  if (result.error) {
    return apiError(result.error, 400);
  }

  for (const attachment of attachments) {
    const content = attachment.base64 ?? attachment.content ?? attachment.text;
    if (!content) continue;

    const fileBuffer = Buffer.from(content, attachment.text ? "utf-8" : "base64");
    await ingestItem({
      userId: user.id,
      type: "file",
      raw_text: subject || null,
      capture_note: `Email attachment from ${from ?? "unknown sender"}`,
      source: "email",
      fileBuffer,
      fileName: attachment.filename,
      fileMimeType: attachment.contentType ?? "application/octet-stream",
    });
  }

  if (resend && from && env.RESEND_FROM_EMAIL) {
    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: from,
      subject: `Saved to Recall: ${subject || "Untitled"}`,
      text: "Your email was saved to Recall successfully.",
    });
  }

  return apiOk({ success: true });
}
