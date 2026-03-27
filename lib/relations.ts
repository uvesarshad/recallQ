export function orderRelationPair(itemAId: string, itemBId: string) {
  return itemAId < itemBId ? [itemAId, itemBId] as const : [itemBId, itemAId] as const;
}

export function clampStrength(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function getHostname(rawUrl?: string | null) {
  if (!rawUrl) return null;

  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
