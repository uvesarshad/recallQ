export function hasIntentSignals(input: string): boolean {
  if (!input) return false;
  const lowered = input.toLowerCase();
  return (
    /#[a-z0-9]/.test(lowered) ||
    /\btags?\s*:/.test(lowered) ||
    /folder\s*:|category\s*:|add this to|move this to/.test(lowered) ||
    /(remind me|reminder|follow up|follow-up)/.test(lowered)
  );
}
