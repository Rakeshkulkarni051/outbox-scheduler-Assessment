"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import Papa from "papaparse";
import { useSession } from "next-auth/react";

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
  const found: string[] = [];

  for (const row of rows) {
    for (const cell of row) {
      const trimmed = cell.trim();

      if (EMAIL_RE.test(trimmed)) {
        found.push(trimmed);
      }
    }
  }

  return found;
}

function formatRecipientName(email: string) {
  const name = email.split("@")[0];

  return name
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date;
}

export function ComposeModal({
  open,
  onClose,
  onScheduled,
}: Props) {
  const { data: session } = useSession();
  const { senders, loading: sendersLoading } = useSenders();

  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recipientInputRef = useRef<HTMLInputElement | null>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [senderId, setSenderId] = useState("");

  const [csvEmails, setCsvEmails] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");

  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  const [startTime, setStartTime] = useState("");

  const [sendLaterOpen, setSendLaterOpen] = useState(false);

  const [pickerDate, setPickerDate] = useState("");
  const [pickerTime, setPickerTime] = useState("10:00");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toolbarOpen, setToolbarOpen] = useState(false);

  /*
   * ------------------------------------------------------------
   * INITIAL / RESET
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!open) return;

    if (!startTime) {
      const now = new Date();

      // Round to next minute.
      now.setSeconds(0);
      now.setMilliseconds(0);

      setStartTime(toLocalDateTime(now));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (!senderId && senders.length > 0) {
      setSenderId(senders[0].id);
    }
  }, [open, senderId, senders]);

  function reset() {
    setSubject("");
    setBody("");
    setSenderId(senders[0]?.id ?? "");

    setCsvEmails([]);
    setCsvFileName(null);

    setRecipients([]);
    setRecipientInput("");

    setDelayMs(2000);
    setHourlyLimit(200);

    setStartTime("");

    setSendLaterOpen(false);
    setPickerDate("");
    setPickerTime("10:00");

    setError(null);
    setSubmitting(false);

    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClose() {
    if (submitting) return;

    reset();
    onClose();
  }

  /*
   * ------------------------------------------------------------
   * RECIPIENTS
   * ------------------------------------------------------------
   */

  function addRecipient(value: string) {
    const emails = value
      .split(/[\n,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => EMAIL_RE.test(email));

    if (emails.length === 0) return;

    setRecipients((current) => {
      const combined = [...current, ...emails];

      return Array.from(new Set(combined));
    });

    setRecipientInput("");
  }

  function removeRecipient(email: string) {
    setRecipients((current) =>
      current.filter((item) => item !== email)
    );
  }

  function handleRecipientKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (
      event.key === "Enter" ||
      event.key === "," ||
      event.key === ";" ||
      event.key === " "
    ) {
      if (recipientInput.trim()) {
        event.preventDefault();
        addRecipient(recipientInput);
      }
    }

    if (
      event.key === "Backspace" &&
      !recipientInput &&
      recipients.length > 0
    ) {
      setRecipients((current) => current.slice(0, -1));
    }
  }

  /*
   * ------------------------------------------------------------
   * CSV
   * ------------------------------------------------------------
   */

 function handleCsvUpload(file: File) {
  setError(null);
  setCsvFileName(file.name);

  // TXT files can simply contain emails separated by
  // commas, spaces, semicolons or new lines.
  if (file.name.toLowerCase().endsWith(".txt")) {
    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result ?? "");

      const found = text
        .split(/[\s,;]+/)
        .map((value) => value.trim().toLowerCase())
        .filter((value) => EMAIL_RE.test(value));

      const uniqueEmails = Array.from(new Set(found));

      setCsvEmails(uniqueEmails);

      setRecipients((current) =>
        Array.from(new Set([...current, ...uniqueEmails]))
      );
    };

    reader.onerror = () => {
      setError("Could not read the text file.");
    };

    reader.readAsText(file);
    return;
  }

  // CSV
  Papa.parse<string[]>(file, {
    skipEmptyLines: true,

    complete: (result) => {
      const found = extractEmailsFromCsv(result.data);

      const uniqueEmails = Array.from(
        new Set(found.map((email) => email.toLowerCase()))
      );

      setCsvEmails(uniqueEmails);

      setRecipients((current) =>
        Array.from(new Set([...current, ...uniqueEmails]))
      );
    },

    error: () => {
      setError("Could not read the CSV file.");
    },
  });
}

  function handleCsvChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    handleCsvUpload(file);
  }

  /*
   * ------------------------------------------------------------
   * EDITOR
   * ------------------------------------------------------------
   */

  function updateBodyFromEditor() {
    const html = editorRef.current?.innerHTML ?? "";

    setBody(html);
  }

  function execEditorCommand(command: string, value?: string) {
    editorRef.current?.focus();

    document.execCommand(command, false, value);

    updateBodyFromEditor();
  }

  function handleEditorKeyDown(
    event: KeyboardEvent<HTMLDivElement>
  ) {
    if (event.key === "Tab") {
      event.preventDefault();

      execEditorCommand("insertText", "    ");
    }
  }

  /*
   * ------------------------------------------------------------
   * DATE / SEND LATER
   * ------------------------------------------------------------
   */

  function openSendLater() {
    const existing = startTime
      ? new Date(startTime)
      : getTomorrow();

    const date = existing.toISOString().slice(0, 10);

    setPickerDate(date);
    setPickerTime(
      `${String(existing.getHours()).padStart(2, "0")}:${String(
        existing.getMinutes()
      ).padStart(2, "0")}`
    );

    setSendLaterOpen(true);
  }

  function applyPicker() {
    if (!pickerDate || !pickerTime) {
      setError("Choose a date and time.");
      return;
    }

    const value = `${pickerDate}T${pickerTime}`;

    const selected = new Date(value);

    if (Number.isNaN(selected.getTime())) {
      setError("Invalid date or time.");
      return;
    }

    if (selected.getTime() < Date.now()) {
      setError("Scheduled time must be in the future.");
      return;
    }

    setStartTime(value);
    setError(null);
    setSendLaterOpen(false);
  }

  function setPreset(hoursFromNow: number) {
    const date = new Date();

    date.setTime(
      Date.now() + hoursFromNow * 60 * 60 * 1000
    );

    date.setSeconds(0);
    date.setMilliseconds(0);

    setPickerDate(date.toISOString().slice(0, 10));

    setPickerTime(
      `${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes()
      ).padStart(2, "0")}`
    );
  }

  function setTomorrowAt(hour: number) {
    const tomorrow = getTomorrow();

    tomorrow.setHours(hour, 0, 0, 0);

    setPickerDate(
      tomorrow.toISOString().slice(0, 10)
    );

    setPickerTime(
      `${String(hour).padStart(2, "0")}:00`
    );
  }

  /*
   * ------------------------------------------------------------
   * SEND
   * ------------------------------------------------------------
   */

  async function handleSubmit() {
    setError(null);

    const cleanRecipients = Array.from(
      new Set([
        ...csvEmails,
        ...recipients,
        ...(recipientInput
          .split(/[\n,;]+/)
          .map((email) => email.trim().toLowerCase())
          .filter((email) => EMAIL_RE.test(email))),
      ])
    );

    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }

    if (!body.trim()) {
      setError("Message body is required.");
      return;
    }

    if (!senderId) {
      setError("Choose a sender.");
      return;
    }

    if (cleanRecipients.length === 0) {
      setError("Add at least one recipient.");
      return;
    }

    if (!startTime) {
      setError("Pick a send time.");
      return;
    }

    const selectedTime = new Date(startTime);

    if (
      Number.isNaN(selectedTime.getTime()) ||
      selectedTime.getTime() < Date.now()
    ) {
      setError("Send time must be in the future.");
      return;
    }

    const input: ScheduleCampaignInput = {
      subject: subject.trim(),
      body,
      senderId,
      startTime: selectedTime.toISOString(),
      delayMs: Math.max(0, delayMs),
      hourlyLimit: Math.max(1, hourlyLimit),
      recipients: cleanRecipients,
    };

    setSubmitting(true);

    try {
      await api.scheduleCampaign(
        input,
        session?.idToken
      );

      reset();
      onScheduled();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to schedule campaign."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * ------------------------------------------------------------
   * SELECTED SENDER
   * ------------------------------------------------------------
   */

  const selectedSender = senders.find(
    (sender) => sender.id === senderId
  );

  const visibleRecipients = recipients.slice(0, 3);
  const hiddenRecipientCount = Math.max(
    recipients.length - visibleRecipients.length,
    0
  );

  const selectedDateText = startTime
    ? new Date(startTime).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Pick date & time";

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white text-[#202124]">
      {/* ========================================================
          TOP BAR
      ======================================================== */}

      <header className="relative flex h-[58px] items-center border-b border-[#F1F2F2] px-5">
        <button
          type="button"
          onClick={handleClose}
          disabled={submitting}
          className="flex items-center gap-1 text-[17px] font-normal text-[#202124] transition hover:text-[#555]"
        >
          <BackIcon />

          <span>Compose New Email</span>
        </button>

        <div className="ml-auto flex items-center gap-5">
          {/* Attachment */}

          <button
            type="button"
            aria-label="Attach file"
            className="text-[#A0A7AA] transition hover:text-[#555]"
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon />
          </button>

          {/* Send Later */}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (sendLaterOpen) {
                  setSendLaterOpen(false);
                } else {
                  openSendLater();
                }
              }}
              className="flex h-[30px] items-center gap-2 rounded-full border border-[#00A94F] px-4 text-[11px] font-medium text-[#00A94F] transition hover:bg-[#F0FBF5]"
            >
              <ClockIcon />

              <span>Send Later</span>
            </button>

            {sendLaterOpen && (
              <SendLaterPopover
                pickerDate={pickerDate}
                pickerTime={pickerTime}
                selectedDateText={selectedDateText}
                onDateChange={setPickerDate}
                onTimeChange={setPickerTime}
                onTomorrow={() => {
                  const tomorrow = getTomorrow();

                  setPickerDate(
                    tomorrow.toISOString().slice(0, 10)
                  );
                }}
                onTomorrow10={() =>
                  setTomorrowAt(10)
                }
                onTomorrow11={() =>
                  setTomorrowAt(11)
                }
                onTomorrow15={() =>
                  setTomorrowAt(15)
                }
                onPreset2Hours={() =>
                  setPreset(2)
                }
                onCancel={() =>
                  setSendLaterOpen(false)
                }
                onDone={applyPicker}
              />
            )}
          </div>

          {/* Send */}

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="h-[30px] min-w-[68px] rounded-full border border-[#00A94F] bg-white px-4 text-[11px] font-medium text-[#00A94F] transition hover:bg-[#00A94F] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Send"}
          </button>
        </div>
      </header>

      {/* ========================================================
          MAIN COMPOSE AREA
      ======================================================== */}

      <main className="mx-auto w-full max-w-[1120px] px-6 lg:px-10">
        {/* FROM */}

        <div className="flex min-h-[53px] items-center border-b border-[#ECEEEE]">
          <label className="w-[46px] shrink-0 text-[10px] text-[#596164]">
            From
          </label>

          <select
            value={senderId}
            onChange={(event) =>
              setSenderId(event.target.value)
            }
            disabled={sendersLoading || submitting}
            className="h-[30px] max-w-[280px] rounded-[8px] bg-[#F5F6F6] px-3 text-[11px] text-[#35393A] outline-none"
          >
            {sendersLoading ? (
              <option value="">
                Loading senders...
              </option>
            ) : (
              <>
                {senders.length === 0 && (
                  <option value="">
                    No senders available
                  </option>
                )}

                {senders.map((sender) => (
                  <option
                    key={sender.id}
                    value={sender.id}
                  >
                    {sender.email}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* TO */}

        <div className="flex min-h-[54px] items-center border-b border-[#ECEEEE]">
          <label className="w-[46px] shrink-0 text-[10px] text-[#596164]">
            To
          </label>

          <div
            className="flex min-h-[34px] flex-1 flex-wrap items-center gap-[5px] py-2"
            onClick={() =>
              recipientInputRef.current?.focus()
            }
          >
            {visibleRecipients.map((email) => (
              <RecipientChip
                key={email}
                email={email}
                onRemove={() =>
                  removeRecipient(email)
                }
              />
            ))}

            {hiddenRecipientCount > 0 && (
              <span className="inline-flex h-[22px] items-center rounded-full border border-[#00A94F] bg-white px-2 text-[9px] font-medium text-[#00A94F]">
                +{hiddenRecipientCount}
              </span>
            )}

            <input
              ref={recipientInputRef}
              value={recipientInput}
              onChange={(event) =>
                setRecipientInput(event.target.value)
              }
              onKeyDown={handleRecipientKeyDown}
              onBlur={() => {
                if (recipientInput.trim()) {
                  addRecipient(recipientInput);
                }
              }}
              disabled={submitting}
              placeholder={
                recipients.length === 0
                  ? "recipient@example.com"
                  : ""
              }
              className="min-w-[130px] flex-1 border-0 bg-transparent px-1 text-[11px] text-[#444] outline-none placeholder:text-[#A7ABAD]"
            />
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() =>
              fileInputRef.current?.click()
            }
            className="ml-3 flex shrink-0 items-center gap-1 text-[10px] text-[#00A94F] hover:underline"
          >
            <UploadIcon />

            <span>Upload List</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
           accept=".csv,.txt,text/csv,text/plain"
            onChange={handleCsvChange}
            className="hidden"
          />
        </div>

        {/* SUBJECT */}

        <div className="flex min-h-[54px] items-center border-b border-[#ECEEEE]">
          <label className="w-[46px] shrink-0 text-[10px] text-[#596164]">
            Subject
          </label>

          <input
            type="text"
            value={subject}
            onChange={(event) =>
              setSubject(event.target.value)
            }
            disabled={submitting}
            placeholder="Subject"
            className="h-full flex-1 border-0 bg-transparent text-[12px] text-[#34393A] outline-none placeholder:text-[#A7ABAD]"
          />
        </div>

        {/* SETTINGS */}

        <div className="flex h-[48px] items-center gap-3">
          <span className="text-[10px] text-[#596164]">
            Delay between 2 emails
          </span>

          <NumberBox
            value={delayMs / 1000}
            suffix=""
            onChange={(value) =>
              setDelayMs(
                Math.max(0, Number(value) * 1000)
              )
            }
          />

          <span className="ml-1 text-[10px] text-[#596164]">
            Hourly Limit
          </span>

          <NumberBox
            value={hourlyLimit}
            suffix=""
            onChange={(value) =>
              setHourlyLimit(
                Math.max(1, Number(value))
              )
            }
          />

          {csvFileName && (
            <span className="ml-2 text-[9px] text-[#8A9092]">
              {csvFileName} · {csvEmails.length} detected
            </span>
          )}
        </div>

        {/* ======================================================
            EDITOR
        ====================================================== */}

        <section className="relative overflow-hidden rounded-[9px] bg-[#F8F8F8]">

  

  {/* Toolbar */}
  <div className="relative z-10 mx-3 mt-3 flex h-[29px] items-center gap-1 rounded-full bg-white px-3">
    <EditorButton
      title="Undo"
      onClick={() =>
        execEditorCommand("undo")
      }
    >
      <UndoIcon />
    </EditorButton>

    <EditorButton
      title="Redo"
      onClick={() =>
        execEditorCommand("redo")
      }
    >
      <RedoIcon />
    </EditorButton>

    <Divider />

    <EditorButton
      title="Font"
      onClick={() =>
        setToolbarOpen((value) => !value)
      }
    >
      <span className="text-[13px]">T</span>
      <ChevronDownSmall />
    </EditorButton>

    <Divider />

    <EditorButton
      title="Bold"
      onClick={() =>
        execEditorCommand("bold")
      }
    >
      <span className="font-bold">B</span>
    </EditorButton>

    <EditorButton
      title="Italic"
      onClick={() =>
        execEditorCommand("italic")
      }
    >
      <span className="italic">I</span>
    </EditorButton>

    <EditorButton
      title="Underline"
      onClick={() =>
        execEditorCommand("underline")
      }
    >
      <span className="underline">U</span>
    </EditorButton>

    <Divider />

    <EditorButton
      title="Align left"
      onClick={() =>
        execEditorCommand("justifyLeft")
      }
    >
      <AlignLeftIcon />
    </EditorButton>

    <EditorButton
      title="Line spacing"
      onClick={() =>
        execEditorCommand("insertText", " ")
      }
    >
      <SpacingIcon />
    </EditorButton>

    <Divider />

    <EditorButton
      title="Numbered list"
      onClick={() =>
        execEditorCommand("insertOrderedList")
      }
    >
      <NumberedListIcon />
    </EditorButton>

    <EditorButton
      title="Bulleted list"
      onClick={() =>
        execEditorCommand("insertUnorderedList")
      }
    >
      <BulletListIcon />
    </EditorButton>

    <EditorButton
      title="Indent"
      onClick={() =>
        execEditorCommand("indent")
      }
    >
      <IndentIcon />
    </EditorButton>

    <EditorButton
      title="Outdent"
      onClick={() =>
        execEditorCommand("outdent")
      }
    >
      <OutdentIcon />
    </EditorButton>

    <Divider />

    <EditorButton
      title="Quote"
      onClick={() =>
        execEditorCommand(
          "formatBlock",
          "blockquote"
        )
      }
    >
      <QuoteIcon />
    </EditorButton>

    <EditorButton
      title="Clear formatting"
      onClick={() =>
        execEditorCommand("removeFormat")
      }
    >
      <ClearFormatIcon />
    </EditorButton>

    {toolbarOpen && (
      <div className="absolute left-[95px] top-[32px] z-50 rounded-md border border-[#E4E6E6] bg-white p-1 shadow-lg">
        <button
          type="button"
          onClick={() => {
            execEditorCommand(
              "fontName",
              "Arial"
            );
            setToolbarOpen(false);
          }}
          className="block px-3 py-1 text-[11px] hover:bg-[#F5F6F6]"
        >
          Arial
        </button>

        <button
          type="button"
          onClick={() => {
            execEditorCommand(
              "fontName",
              "Georgia"
            );
            setToolbarOpen(false);
          }}
          className="block px-3 py-1 text-[11px] hover:bg-[#F5F6F6]"
        >
          Georgia
        </button>

        <button
          type="button"
          onClick={() => {
            execEditorCommand(
              "fontName",
              "Courier New"
            );
            setToolbarOpen(false);
          }}
          className="block px-3 py-1 text-[11px] hover:bg-[#F5F6F6]"
        >
          Courier New
        </button>
      </div>
    )}
  </div>

  {/* Editable message area */}
  <div className="relative mt-0">

    {!body && (
      <div className="pointer-events-none absolute left-4 top-3 z-0 text-[16px] text-[#B1B5B6]">
        Type Your Reply...
      </div>
    )}

    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={updateBodyFromEditor}
      onKeyDown={handleEditorKeyDown}
      className="relative z-10 min-h-[280px] w-full bg-transparent px-4 py-4 text-[12px] leading-[1.7] text-[#34393B] outline-none"
    />
  </div>
</section>

        {/* Error */}

        {error && (
          <div className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-600">
            {error}
          </div>
        )}

        {/* Small recipient information */}

        {recipients.length > 0 && (
          <div className="pb-8 pt-3 text-[9px] text-[#969B9D]">
            {recipients.length} unique recipient
            {recipients.length === 1 ? "" : "s"}
          </div>
        )}
      </main>
    </div>
  );
}

/*
 * ================================================================
 * SEND LATER POPOVER
 * ================================================================
 */

function SendLaterPopover({
  pickerDate,
  pickerTime,
  onDateChange,
  onTimeChange,
  onTomorrow,
  onTomorrow10,
  onTomorrow11,
  onTomorrow15,
  onCancel,
  onDone,
}: {
  pickerDate: string;
  pickerTime: string;
  selectedDateText: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onTomorrow: () => void;
  onTomorrow10: () => void;
  onTomorrow11: () => void;
  onTomorrow15: () => void;
  onPreset2Hours: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <div className="absolute right-0 top-[38px] z-[120] w-[220px] rounded-[7px] border border-[#E4E6E6] bg-white p-3 shadow-[0_3px_12px_rgba(0,0,0,0.14)]">
      <div className="mb-3 text-[11px] font-medium text-[#333739]">
        Send Later
      </div>

      {/* Date */}

      <div className="relative">
        <input
          type="date"
          value={pickerDate}
          onChange={(event) =>
            onDateChange(event.target.value)
          }
          className="h-[32px] w-full border-b border-[#E4E6E6] bg-white pr-7 text-[10px] text-[#5F6668] outline-none"
        />

        <CalendarIcon />
      </div>

      {/* Time */}

      <div className="mt-2">
        <input
          type="time"
          value={pickerTime}
          onChange={(event) =>
            onTimeChange(event.target.value)
          }
          className="h-[32px] w-full border-b border-[#E4E6E6] bg-white text-[10px] text-[#5F6668] outline-none"
        />
      </div>

      {/* Presets */}

      <div className="mt-2">
        <button
          type="button"
          onClick={onTomorrow}
          className="block w-full px-1 py-[7px] text-left text-[10px] text-[#555D60] hover:bg-[#F6F7F7]"
        >
          Tomorrow
        </button>

        <button
          type="button"
          onClick={onTomorrow10}
          className="block w-full px-1 py-[7px] text-left text-[10px] text-[#555D60] hover:bg-[#F6F7F7]"
        >
          Tomorrow, 10:00 AM
        </button>

        <button
          type="button"
          onClick={onTomorrow11}
          className="block w-full px-1 py-[7px] text-left text-[10px] text-[#555D60] hover:bg-[#F6F7F7]"
        >
          Tomorrow, 11:00 AM
        </button>

        <button
          type="button"
          onClick={onTomorrow15}
          className="block w-full px-1 py-[7px] text-left text-[10px] text-[#555D60] hover:bg-[#F6F7F7]"
        >
          Tomorrow, 3:00 PM
        </button>
      </div>

      {/* Footer */}

      <div className="mt-4 flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] text-[#333739] hover:text-black"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onDone}
          className="h-[27px] rounded-full border border-[#00A94F] px-4 text-[10px] font-medium text-[#00A94F] hover:bg-[#00A94F] hover:text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/*
 * ================================================================
 * RECIPIENT CHIP
 * ================================================================
 */

function RecipientChip({
  email,
  onRemove,
}: {
  email: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex h-[22px] max-w-[190px] items-center gap-1 rounded-full border border-[#00A94F] bg-[#F4FCF7] px-2 text-[9px] text-[#167B45]">
      <span className="truncate">
        {email}
      </span>

      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 text-[#64A47F] hover:text-[#167B45]"
        aria-label={`Remove ${email}`}
      >
        ×
      </button>
    </span>
  );
}

/*
 * ================================================================
 * NUMBER BOX
 * ================================================================
 */

function NumberBox({
  value,
  onChange,
}: {
  value: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(event) =>
        onChange(Number(event.target.value))
      }
      className="h-[27px] w-[52px] rounded-[5px] border border-[#E3E5E5] bg-white px-2 text-center text-[10px] text-[#555] outline-none focus:border-[#00A94F]"
    />
  );
}

/*
 * ================================================================
 * EDITOR BUTTON
 * ================================================================
 */

function EditorButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(event) =>
        event.preventDefault()
      }
      onClick={onClick}
      className="flex h-[23px] min-w-[22px] items-center justify-center gap-0.5 rounded text-[#858B8D] transition hover:bg-[#F2F3F3] hover:text-[#444]"
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div className="mx-1 h-[16px] w-px bg-[#E7E8E8]" />
  );
}

/*
 * ================================================================
 * ICONS
 * ================================================================
 */

function BackIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M15 18L9 12L15 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M20.5 11.5L12.2 19.8C9.9 22.1 6.2 22.1 3.9 19.8C1.6 17.5 1.6 13.8 3.9 11.5L12.4 3C14.1 1.3 16.8 1.3 18.5 3C20.2 4.7 20.2 7.4 18.5 9.1L10 17.6C9 18.6 7.4 18.6 6.4 17.6C5.4 16.6 5.4 15 6.4 14L14.3 6.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
      />

      <path
        d="M12 8V12L15 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      className="pointer-events-none absolute right-1 top-2"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2"
        stroke="#899193"
        strokeWidth="1.4"
      />

      <path
        d="M8 3V7M16 3V7M4 10H20"
        stroke="#899193"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M12 16V4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      <path
        d="M8 8L12 4L16 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M5 13V19H19V13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M9 7L4 12L9 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M5 12H14C18 12 20 14 20 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M15 7L20 12L15 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M19 12H10C6 12 4 14 4 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownSmall() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlignLeftIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M4 6H20M4 10H16M4 14H20M4 18H16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpacingIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M6 7H18M6 12H18M6 17H18"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      <path
        d="M3 4V20"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function NumberedListIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M9 6H20M9 12H20M9 18H20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="M4 5H5V8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      <path
        d="M4 11C5 10 6 11 6 12C6 13 4 14 4 15H6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />

      <path
        d="M4 18H6L4 21H6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="5"
        cy="6"
        r="1"
        fill="currentColor"
      />

      <circle
        cx="5"
        cy="12"
        r="1"
        fill="currentColor"
      />

      <circle
        cx="5"
        cy="18"
        r="1"
        fill="currentColor"
      />

      <path
        d="M9 6H20M9 12H20M9 18H20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IndentIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M9 6H20M9 12H20M9 18H20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="M4 8L7 12L4 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OutdentIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M9 6H20M9 12H20M9 18H20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="M7 8L4 12L7 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M6 11H10V17H4V13C4 9 6 7 10 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M16 11H20V17H14V13C14 9 16 7 20 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClearFormatIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M6 5H17M11 5L8 19M5 19H13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="M16 14L21 19M21 14L16 19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}