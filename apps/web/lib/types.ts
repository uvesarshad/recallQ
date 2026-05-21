export type ArchiveItemType = "url" | "text" | "file" | "note";

export interface ArchiveItem {
  id: string;
  type: ArchiveItemType;
  title?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  source?: string | null;
  created_at: string;
  updated_at?: string | null;
  raw_url?: string | null;
  raw_text?: string | null;
  collection_id?: string | null;
  collection_name?: string | null;
  canvas_x?: number | null;
  canvas_y?: number | null;
  canvas_pinned?: boolean;
  enriched?: boolean;
  enriched_at?: string | null;
  reminder_at?: string | null;
  reminder_sent?: boolean;
  file_path?: string | null;
  file_name?: string | null;
  file_mime_type?: string | null;
  capture_note?: string | null;
  image_url?: string | null;
  snippet?: string | null;
  similarity?: number;
}

export interface ArchiveComment {
  id: string;
  body: string;
  created_at: string;
}

export interface CollectionRecord {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
}

export interface ProfileRecord {
  id: string;
  email: string;
  name: string | null;
  bio: string | null;
  timezone: string | null;
  marketing_consent: boolean;
  analytics_consent: boolean;
  inbound_email_address: string | null;
  plan: string | null;
  created_at: string;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  subscription_current_start?: string | null;
  subscription_current_end?: string | null;
  subscription_cancel_at_cycle_end?: boolean | null;
  razorpay_subscription_id?: string | null;
}

export interface ChatMessagePayload {
  role: "user" | "assistant" | "system";
  content: string;
}
