import { z } from "zod";

export const ingestPayloadSchema = z.object({
  type: z.enum(["url", "text", "file", "note"]),
  raw_url: z.string().url().nullable().optional(),
  raw_text: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().max(200).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional().default([]),
  capture_note: z.string().trim().max(500).nullable().optional(),
  reminder_at: z.string().datetime().nullable().optional(),
  source: z.enum(["web", "pwa-share", "telegram", "email", "extension", "manual"]),
  collection_id: z.string().uuid().nullable().optional(),
});

export const bulkIngestPayloadSchema = z.object({
  items: z.array(ingestPayloadSchema).min(1).max(100),
});

export const itemCanvasUpdateSchema = z.object({
  canvas_x: z.number().finite(),
  canvas_y: z.number().finite(),
});

export const inboundAttachmentSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  base64: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
});

export const actionOverrideSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(50)).optional(),
  categoryName: z.string().trim().min(1).max(100).nullable().optional(),
  reminderAt: z.string().datetime().nullable().optional(),
});

export const emailInboundSchema = z.object({
  from: z.string().email().optional(),
  to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(inboundAttachmentSchema).optional().default([]),
});
