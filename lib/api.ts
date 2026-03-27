import { NextResponse } from "next/server";

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function apiError(
  error: string,
  status = 400,
  extras?: Record<string, unknown>,
) {
  return NextResponse.json({ error, ...extras }, { status });
}
