export function resolvePreviewImageUrl(imageUrl: string | null | undefined, rawUrl: string | null | undefined) {
  if (!imageUrl) {
    return null;
  }

  try {
    if (/^https?:\/\//i.test(imageUrl)) {
      return imageUrl;
    }

    if (!rawUrl) {
      return null;
    }

    return new URL(imageUrl, rawUrl).toString();
  } catch {
    return null;
  }
}
