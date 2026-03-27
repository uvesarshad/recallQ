import { auth } from "@/lib/auth";
import { ingestItem } from "@/lib/ingest";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/app/login?next=/app", req.url), 303);
  }

  const formData = await req.formData();
  const text = formData.get("text") as string;
  const url = formData.get("url") as string;
  const file = formData.get("file");

  let type: "url" | "text" = "text";
  let raw_url = url;
  if (!raw_url && text && text.match(/^https?:\/\//)) {
    raw_url = text;
    type = "url";
  } else if (raw_url) {
    type = "url";
  }

  try {
    const result = await ingestItem(
      file instanceof File
        ? {
            userId: session.user.id,
            type: "file",
            raw_text: text || null,
            source: "pwa-share",
            fileBuffer: Buffer.from(await file.arrayBuffer()),
            fileName: file.name,
            fileMimeType: file.type,
          }
        : {
            userId: session.user.id,
            type,
            raw_url: raw_url || null,
            raw_text: text || null,
            source: "pwa-share",
          }
    );

    if (result.error === "limit_reached") {
      return NextResponse.redirect(new URL("/app/settings?error=limit_reached", req.url), 303);
    }

    if (result.error === "unsupported_file_type") {
      return NextResponse.redirect(new URL("/app?error=unsupported_file_type", req.url), 303);
    }

    return NextResponse.redirect(new URL("/app?saved=true", req.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/app?error=failed", req.url), 303);
  }
}
