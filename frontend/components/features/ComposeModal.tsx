"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { useSession } from "next-auth/react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useSenders } from "@/hooks/useSenders";
import { api } from "@/lib/api";
import type { ScheduleCampaignInput } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

function extractEmailsFromCsv(rows: string[][]): string[] {
  // Accept any CSV shape: pull every cell that looks like an email address,
  // rather than assuming a fixed column (works whether there's a header
  // row, an "email" column, or just a single bare column of addresses).
  const found: string[] = [];
  for (const row of rows) {
    for (const cell of row) {
      const trimmed = cell.trim();
      if (EMAIL_RE.test(trimmed)) found.push(trimmed);
    }
  }
  return found;
}

export function ComposeModal({ open, onClose, onScheduled }: Props) {
  const { data: session } = useSession();
  const { senders, loading: sendersLoading } = useSenders();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderId, setSenderId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [csvEmails, setCsvEmails] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [pastedRecipients, setPastedRecipients] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pastedEmails = useMemo(
    () =>
      pastedRecipients
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => EMAIL_RE.test(s)),
    [pastedRecipients]
  );

  const recipients = useMemo(
    () => Array.from(new Set([...csvEmails, ...pastedEmails])),
    [csvEmails, pastedEmails]
  );

  function handleCsvUpload(file: File) {
    setCsvFileName(file.name);
    Papa.parse<string[]>(file, {
      complete: (result) => {
        setCsvEmails(extractEmailsFromCsv(result.data));
      },
    });
  }

  function reset() {
    setSubject("");
    setBody("");
    setSenderId("");
    setStartTime("");
    setDelayMs(2000);
    setHourlyLimit(200);
    setCsvEmails([]);
    setCsvFileName(null);
    setPastedRecipients("");
    setError(null);
  }

  async function handleSubmit() {
    setError(null);

    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required.");
      return;
    }
    if (!senderId) {
      setError("Choose a sender.");
      return;
    }
    if (!startTime) {
      setError("Pick a start time.");
      return;
    }
    if (recipients.length === 0) {
      setError("Add at least one recipient (CSV upload or paste emails).");
      return;
    }

    const input: ScheduleCampaignInput = {
      subject,
      body,
      senderId,
      startTime: new Date(startTime).toISOString(),
      delayMs,
      hourlyLimit,
      recipients,
    };

    setSubmitting(true);
    try {
      await api.scheduleCampaign(input, session?.idToken);
      reset();
      onScheduled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Compose new email">
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea
          placeholder="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm h-28"
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Sender</label>
          <select
            value={senderId}
            onChange={(e) => setSenderId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">
              {sendersLoading ? "Loading senders..." : "Select a sender"}
            </option>
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ? `${s.name} <${s.email}>` : s.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Recipients (CSV upload)
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && handleCsvUpload(e.target.files[0])}
            className="w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {csvFileName && (
            <p className="mt-1 text-xs text-gray-500">
              {csvFileName}: {csvEmails.length} address{csvEmails.length === 1 ? "" : "es"} detected
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Or paste emails (comma / newline separated)
          </label>
          <textarea
            placeholder="a@example.com, b@example.com"
            value={pastedRecipients}
            onChange={(e) => setPastedRecipients(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm h-16"
          />
        </div>

        <p className="text-xs text-gray-500">
          Total unique recipients: <span className="font-medium text-gray-700">{recipients.length}</span>
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Start time</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Min delay (ms)</label>
            <Input
              type="number"
              min={0}
              value={delayMs}
              onChange={(e) => setDelayMs(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Hourly limit</label>
            <Input
              type="number"
              min={1}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Scheduling..." : "Schedule"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
