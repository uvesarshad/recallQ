export function getSafeRedirectTarget(target?: FormDataEntryValue | string | null) {
  const value = typeof target === "string" ? target : "";
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/app";
  }

  return value;
}
