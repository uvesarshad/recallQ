import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;
const HASH_PREFIX = "scrypt";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${HASH_PREFIX}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) {
    return false;
  }

  const [prefix, salt, hash] = storedHash.split(":");
  if (prefix !== HASH_PREFIX || !salt || !hash) {
    return false;
  }

  const stored = Buffer.from(hash, "hex");
  const candidate = scryptSync(password, salt, stored.length);

  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}
