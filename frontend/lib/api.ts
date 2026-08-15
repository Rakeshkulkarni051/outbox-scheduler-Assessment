import type { EmailRecord } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getScheduledEmails: () => request<EmailRecord[]>("/emails/scheduled"),
  getSentEmails: () => request<EmailRecord[]>("/emails/sent"),
  scheduleCampaign: (input: unknown) =>
    request("/schedule", { method: "POST", body: JSON.stringify(input) }),
};
