import { createHash, randomBytes } from "crypto";

const TOKEN_BRAND = "rq_";
const RAW_BYTES = 36; // 36 bytes -> 48 base64url chars
const PREFIX_LENGTH = 8;

export type GeneratedToken = {
  raw: string;
  hash: string;
  prefix: string;
};

// Generates a new token plus its storage-safe hash and the public prefix.
// The raw value is shown to the user once at issue time and never persisted.
export function generateToken(): GeneratedToken {
  const random = randomBytes(RAW_BYTES).toString("base64url");
  const raw = `${TOKEN_BRAND}${random}`;
  const prefix = random.slice(0, PREFIX_LENGTH);
  const hash = hashToken(raw);
  return { raw, hash, prefix };
}

// SHA-256 of the raw token, base64url-encoded. Used as the storage key in
// `personal_access_tokens.token_hash` and recomputed on every authenticated
// request to look the token up.
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("base64url");
}

// Strips and validates a bearer header value. Returns the raw token string
// only if it looks plausible (correct brand + min length); does not consult
// the database.
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  const raw = match[1];
  if (!raw.startsWith(TOKEN_BRAND)) return null;
  if (raw.length < TOKEN_BRAND.length + PREFIX_LENGTH) return null;
  return raw;
}
