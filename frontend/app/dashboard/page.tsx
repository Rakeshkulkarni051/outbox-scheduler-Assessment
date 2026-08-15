"use client";

import { useState } from "react";
import { DashboardHeader } from "@/components/features/DashboardHeader";
import { ComposeModal } from "@/components/features/ComposeModal";
import { ScheduledEmailsTable } from "@/components/features/ScheduledEmailsTable";
import { SentEmailsTable } from "@/components/features/SentEmailsTable";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { useScheduledEmails } from "@/hooks/useScheduledEmails";
import { useSentEmails } from "@/hooks/useSentEmails";

type Tab = "scheduled" | "sent";

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("scheduled");
  const [composeOpen, setComposeOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const scheduled = useScheduledEmails();
  const sent = useSentEmails();

  function handleScheduled() {
    scheduled.refetch();
    sent.refetch();
    setToast("Campaign scheduled.");
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <main>
      <DashboardHeader />

      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 rounded-md bg-gray-100 p-1 text-sm">
            <button
              onClick={() => setTab("scheduled")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                tab === "scheduled" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
              }`}
            >
              Scheduled ({scheduled.emails.length})
            </button>
            <button
              onClick={() => setTab("sent")}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                tab === "sent" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
              }`}
            >
              Sent ({sent.emails.length})
            </button>
          </div>

          <Button onClick={() => setComposeOpen(true)}>Compose</Button>
        </div>

        <div className="rounded-lg border bg-white">
          {tab === "scheduled" ? (
            <ScheduledEmailsTable emails={scheduled.emails} loading={scheduled.loading} />
          ) : (
            <SentEmailsTable emails={sent.emails} loading={sent.loading} />
          )}
        </div>
      </div>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onScheduled={handleScheduled}
      />

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </main>
  );
}
