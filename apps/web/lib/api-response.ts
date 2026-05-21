import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import {
  type ErrorCode,
  type ErrorResponse,
} from "@recall/api-schema";

export function ok<T>(data: T, init?: ResponseInit): Response {
  return NextResponse.json(data as object, init);
}

export function fail(
  code: ErrorCode,
  message: string,
  status = 400,
  details?: unknown,
): Response {
  const body: ErrorResponse =
    details === undefined
      ? { error: message, code }
      : { error: message, code, details };
  return NextResponse.json(body, { status });
}

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

// Reads a JSON body and validates against a Zod schema. On failure returns a
// pre-built 400 response the caller can return directly.
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: fail("validation_error", "Invalid JSON body", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: fail("validation_error", "Invalid request body", 400, parsed.error.issues),
    };
  }
  return { ok: true, data: parsed.data };
}
