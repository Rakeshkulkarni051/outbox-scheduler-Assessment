import type { Campaign, EmailRecord, ScheduleCampaignInput, Sender } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { headers, ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }
  return res.json();
}

// Every call takes the NextAuth session's Google id_token (see
// components/providers/AuthProvider.tsx / useSession()) and forwards it as
// a bearer token — the backend's requireGoogleAuth middleware verifies it
// on every protected route (schedule, emails, senders).
export const api = {
  getScheduledEmails: (token?: string) => request<EmailRecord[]>("/emails/scheduled", undefined, token),
  getSentEmails: (token?: string) => request<EmailRecord[]>("/emails/sent", undefined, token),
  getSenders: (token?: string) => request<Sender[]>("/senders", undefined, token),
  scheduleCampaign: (input: ScheduleCampaignInput, token?: string) =>
    request<Campaign>("/schedule", { method: "POST", body: JSON.stringify(input) }, token),
};
