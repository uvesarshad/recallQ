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
  blur_data_url?: string | null;
  archive_requested_at?: string | null;
  archive_status?: "not_requested" | "pending" | "processing" | "available" | "failed" | null;
  archive_last_error?: string | null;
  archive_last_attempt_at?: string | null;
  link_last_checked_at?: string | null;
  link_http_status?: number | null;
  link_broken?: boolean | null;
  link_failure_reason?: string | null;
  link_review_status?: "unreviewed" | "needs_review" | "retrying" | "false_positive" | "resolved" | null;
  link_reviewed_at?: string | null;
  link_review_note?: string | null;
  reading_progress?: number | null;
  reading_state?: "unread" | "reading" | "read" | null;
  reader_position?: string | null;
  is_favorite?: boolean | null;
  is_archived?: boolean | null;
  is_read_later?: boolean | null;
  reading_started_at?: string | null;
  reading_completed_at?: string | null;
  snippet?: string | null;
  similarity?: number;
}

export interface ItemHighlight {
  id: string;
  item_id: string;
  quote: string;
  note?: string | null;
  color: "yellow" | "green" | "blue" | "pink" | "purple";
  range_start?: number | null;
  range_end?: number | null;
  created_at: string;
  updated_at: string;
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
