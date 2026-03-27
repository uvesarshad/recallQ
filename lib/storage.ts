import fs from "fs/promises";
import path from "path";
import { env } from "@/lib/env";

const BASE_PATH = env.FILES_BASE_PATH;

const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "text/markdown",
  "text/plain",
];

export function isAcceptedMimeType(mimeType: string | null | undefined) {
  if (!mimeType) return false;

  return (
    ACCEPTED_MIME_TYPES.includes(mimeType) ||
    mimeType.startsWith("image/") ||
    mimeType.startsWith("application/vnd.openxmlformats-officedocument.") ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function saveFile(userId: string, itemId: string, filename: string, buffer: Buffer) {
  const userDir = path.join(BASE_PATH, userId, itemId);
  await fs.mkdir(userDir, { recursive: true });
  
  const filePath = path.join(userDir, sanitizeFilename(filename));
  await fs.writeFile(filePath, buffer);
  
  return filePath;
}

export async function getFileBuffer(filePath: string) {
  return await fs.readFile(filePath);
}
