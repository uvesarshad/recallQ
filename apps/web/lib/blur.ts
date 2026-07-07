import sharp from "sharp";
import { logger } from "@/lib/logger";
import { safeFetch } from "@/lib/url-safety";

const FETCH_TIMEOUT_MS = 5_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Fetches a remote image, resizes to 16x16, and encodes a base64 JPEG
// suitable for use as `next/image` `placeholder="blur"` / `blurDataURL`.
// Returns `null` on any failure (network, timeout, oversize, decode error)
// so the caller can persist `NULL` and let next/image fall through to its
// shimmer fallback. Never throws.
//
// Why 16x16 JPEG q40: keeps the encoded string under ~400 bytes — small
// enough to ship inline in every feed item without bloating the page HTML.
export async function computeBlurDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await safeFetch(imageUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) return null;

    const contentLength = Number(response.headers.get("content-length"));
    if (contentLength && contentLength > MAX_IMAGE_BYTES) return null;

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) return null;

    const buf = Buffer.from(arrayBuffer);
    const resized = await sharp(buf)
      .resize(16, 16, { fit: "inside" })
      .jpeg({ quality: 40 })
      .toBuffer();

    return `data:image/jpeg;base64,${resized.toString("base64")}`;
  } catch (error) {
    logger.warn("blur", "Failed to compute blur placeholder", {
      url: imageUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
