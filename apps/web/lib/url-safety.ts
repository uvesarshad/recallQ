import { lookup } from "dns/promises";
import net from "net";

const DEFAULT_MAX_REDIRECTS = 3;

const BLOCKED_HOSTNAMES = new Set(["localhost"]);

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function normalizeIp(value: string) {
  return value.startsWith("::ffff:") ? value.slice(7) : value;
}

function ipv4ToNumber(value: string) {
  return value.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function isIpv4InCidr(value: string, base: string, bits: number) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToNumber(value) & mask) === (ipv4ToNumber(base) & mask);
}

export function isBlockedIpAddress(address: string) {
  const normalized = normalizeIp(address);
  const ipVersion = net.isIP(normalized);

  if (ipVersion === 4) {
    return [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ].some(([base, bits]) => isIpv4InCidr(normalized, String(base), Number(bits)));
  }

  if (ipVersion === 6) {
    const lower = normalized.toLowerCase();
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80:") ||
      lower.startsWith("ff")
    );
  }

  return true;
}

export function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return BLOCKED_HOSTNAMES.has(normalized) || normalized.endsWith(".localhost");
}

export function parseSafeHttpUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs are allowed");
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed");
  }

  if (isBlockedHostname(url.hostname)) {
    throw new UnsafeUrlError("Blocked hostname");
  }

  const ipVersion = net.isIP(normalizeIp(url.hostname));
  if (ipVersion && isBlockedIpAddress(url.hostname)) {
    throw new UnsafeUrlError("Blocked IP address");
  }

  return url;
}

export async function assertPublicFetchUrl(rawUrl: string) {
  const url = parseSafeHttpUrl(rawUrl);
  const directIp = normalizeIp(url.hostname);

  if (net.isIP(directIp)) {
    return url;
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new UnsafeUrlError("Hostname did not resolve");
  }

  if (addresses.some((entry) => isBlockedIpAddress(entry.address))) {
    throw new UnsafeUrlError("Hostname resolved to a blocked address");
  }

  return url;
}

export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
  options: { maxRedirects?: number } = {},
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let currentUrl = (await assertPublicFetchUrl(rawUrl)).toString();

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }

    if (redirectCount === maxRedirects) {
      throw new UnsafeUrlError("Too many redirects");
    }

    currentUrl = (await assertPublicFetchUrl(new URL(location, currentUrl).toString())).toString();
  }

  throw new UnsafeUrlError("Too many redirects");
}
