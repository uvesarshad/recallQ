import { z } from "zod";

// POST /api/v1/auth/token — exchange credentials for a personal access token.
export const TokenIssueInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  device_name: z
    .string()
    .min(1)
    .max(64)
    .describe("Human-readable device label, e.g. 'iPhone' or 'Chrome'"),
});
export type TokenIssueInput = z.infer<typeof TokenIssueInputSchema>;

// Returned only at issue time. The raw `token` value is never readable again
// once the response is consumed; clients must persist it immediately.
export const TokenIssueOutputSchema = z.object({
  token: z.string(),
  id: z.string().uuid(),
  prefix: z.string(),
  device_name: z.string(),
  created_at: z.string(),
});
export type TokenIssueOutput = z.infer<typeof TokenIssueOutputSchema>;

// Summary shape used by GET /api/v1/auth/tokens; never includes the raw token.
export const TokenSummarySchema = z.object({
  id: z.string().uuid(),
  device_name: z.string(),
  prefix: z.string(),
  last_used_at: z.string().nullable(),
  created_at: z.string(),
});
export type TokenSummary = z.infer<typeof TokenSummarySchema>;

export const TokenListResponseSchema = z.object({
  tokens: z.array(TokenSummarySchema),
});
export type TokenListResponse = z.infer<typeof TokenListResponseSchema>;
