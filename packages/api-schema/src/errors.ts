import { z } from "zod";

export const ErrorCodes = [
  "validation_error",
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limited",
  "conflict",
  "internal_error",
  "plan_limit_exceeded",
] as const;

export const ErrorCodeSchema = z.enum(ErrorCodes);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: ErrorCodeSchema,
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
