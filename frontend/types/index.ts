// Mirrors the backend's Prisma models (backend/prisma/schema.prisma) — kept
// in sync by hand for now since this is a small monorepo, not published as
// a shared package.

export type EmailStatus = "pending" | "queued" | "sent" | "failed";

export interface Sender {
  id: string;
  email: string;
  name?: string | null;
}

export interface Campaign {
  id: string;
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  status: string;
}

export interface EmailRecord {
  id: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  scheduledTime: string;
  sentTime: string | null;
  status: EmailStatus;
  campaign: Campaign;
}
