"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";

import { ComposeModal } from "@/components/features/ComposeModal";
import { Toast } from "@/components/ui/Toast";
import { useScheduledEmails } from "@/hooks/useScheduledEmails";
import { useSentEmails } from "@/hooks/useSentEmails";
import { useRouter } from "next/navigation";

type Tab = "scheduled" | "sent";

export default function DashboardPage() {
  const { data: session } = useSession();

  const [tab, setTab] = useState<Tab>("scheduled");
  const [composeOpen, setComposeOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const scheduled = useScheduledEmails();
  const sent = useSentEmails();

  function handleScheduled() {
    scheduled.refetch();
    sent.refetch();

    setToast("Campaign scheduled.");

    setTimeout(() => {
      setToast(null);
    }, 3500);
  }

  const displayName = session?.user?.name?.trim() || "User";
  const displayEmail = session?.user?.email || "";

  const avatar =
    session?.user?.image ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=E5E7EB&color=555555&size=64`;

  const emails = tab === "scheduled" ? scheduled.emails : sent.emails;
  const loading = tab === "scheduled" ? scheduled.loading : sent.loading;

  return (
    <main className="min-h-screen w-full bg-white text-[#202124]">
      <div className="flex min-h-screen w-full">

        {/* =========================================================
            SIDEBAR
        ========================================================= */}
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col border-r border-[#F0F1F1] bg-white px-3">

          {/* Logo */}
          <div className="px-2 pt-4">
            <div className="text-[32px] font-black leading-none tracking-[-3px] text-[#171717]">
              ONG
            </div>
          </div>

          {/* Profile */}
          <div className="relative mt-4">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex h-[52px] w-full items-center rounded-[10px] bg-[#F5F7F7] px-3 text-left transition hover:bg-[#EEF1F1]"
            >
              <img
                src={avatar}
                alt=""
                className="h-[34px] w-[34px] rounded-full object-cover"
              />

              <div className="ml-3 min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium leading-4 text-[#343434]">
                  {displayName}
                </div>

                <div className="truncate text-[9px] leading-3 text-[#8A8F92]">
                  {displayEmail}
                </div>
              </div>

              <ChevronIcon />
            </button>

            {profileOpen && (
              <div className="absolute left-0 top-[58px] z-50 w-full rounded-[9px] border border-[#E4E7E7] bg-white p-1 shadow-[0_5px_20px_rgba(0,0,0,0.10)]">
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="h-9 w-full rounded-md px-3 text-left text-[12px] text-[#444] hover:bg-[#F5F6F6]"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Compose */}
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="mt-3 h-[34px] w-full rounded-full border border-[#00AE4F] bg-white text-[13px] font-medium text-[#00A94F] transition hover:bg-[#F0FBF5]"
          >
            Compose
          </button>

          {/* Core */}
          <div className="mt-7 px-2 text-[10px] font-medium uppercase tracking-[0.5px] text-[#A7AAAC]">
            CORE
          </div>

          {/* Navigation */}
          <nav className="mt-2 space-y-1">

            {/* Scheduled */}
            <button
              type="button"
              onClick={() => setTab("scheduled")}
              className={`flex h-[40px] w-full items-center rounded-[9px] px-3 transition ${
                tab === "scheduled"
                  ? "bg-[#E2F5EB]"
                  : "hover:bg-[#F7F8F8]"
              }`}
            >
              <ClockIcon />

              <span
                className={`ml-3 text-[13px] ${
                  tab === "scheduled"
                    ? "font-medium text-[#303735]"
                    : "text-[#454A4A]"
                }`}
              >
                Scheduled
              </span>

              <span className="ml-auto text-[10px] text-[#8A9190]">
                {scheduled.emails.length}
              </span>
            </button>

            {/* Sent */}
            <button
              type="button"
              onClick={() => setTab("sent")}
              className={`flex h-[40px] w-full items-center rounded-[9px] px-3 transition ${
                tab === "sent"
                  ? "bg-[#E2F5EB]"
                  : "hover:bg-[#F7F8F8]"
              }`}
            >
              <SendIcon />

              <span
                className={`ml-3 text-[13px] ${
                  tab === "sent"
                    ? "font-medium text-[#303735]"
                    : "text-[#454A4A]"
                }`}
              >
                Sent
              </span>

              <span className="ml-auto text-[10px] text-[#8A9190]">
                {sent.emails.length}
              </span>
            </button>
          </nav>
        </aside>

        {/* =========================================================
            MAIN
        ========================================================= */}
        <section className="ml-[220px] min-h-screen min-w-0 flex-1">

          {/* Toolbar */}
          <header className="flex h-[70px] w-full items-center border-b border-[#F3F4F4] px-7">

            {/* Search */}
            <div className="relative w-full max-w-[620px]">
              <SearchIcon />

              <input
                type="text"
                placeholder="Search"
                className="h-[38px] w-full rounded-full border-0 bg-[#F3F6F5] pl-[42px] pr-4 text-[13px] text-[#555] outline-none placeholder:text-[#A7AFB1]"
              />
            </div>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-6">
              <button
                type="button"
                aria-label="Filter"
                className="text-[#9DA5A7] transition hover:text-[#555]"
              >
                <FilterIcon />
              </button>

              <button
                type="button"
                aria-label="Refresh"
                onClick={() => {
                  scheduled.refetch();
                  sent.refetch();
                }}
                className="text-[#9DA5A7] transition hover:text-[#555]"
              >
                <RefreshIcon />
              </button>
            </div>
          </header>

          {/* =======================================================
              EMAIL LIST
          ======================================================= */}
          <div className="w-full">

            {loading ? (
              <LoadingRows />
            ) : emails.length === 0 ? (
              <EmptyState tab={tab} />
            ) : (
              emails.map((email, index) => (
                <EmailRow
                  key={email.id ?? index}
                  email={email}
                  tab={tab}
                />
              ))
            )}

          </div>
        </section>
      </div>

      {/* Compose */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onScheduled={handleScheduled}
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast}
          onDismiss={() => setToast(null)}
        />
      )}
    </main>
  );
}

/* ================================================================
   EMAIL ROW
================================================================ */

function EmailRow({
  email,
  tab,
}: {
  email: any;
  tab: Tab;
}) {
  const router = useRouter();

  const recipient = email.recipient || "Unknown recipient";
  const subject = email.campaign?.subject || "No subject";
const body = email.campaign?.body || "";

  const preview = body
  .replace(/<[^>]*>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/\s+/g, " ")
  .trim();

  const dateValue =
    tab === "scheduled"
      ? email.scheduledTime
      : email.sentTime;

  const date = dateValue ? new Date(dateValue) : null;

  function openEmail() {
    if (!email.id) return;

    router.push(
      `/dashboard/email/${encodeURIComponent(email.id)}?tab=${tab}`
    );
  }

  return (
    <button
      type="button"
      onClick={openEmail}
      className="group flex min-h-[60px] w-full items-center border-b border-[#F0F1F1] bg-white px-7 text-left transition hover:bg-[#FAFCFB]"
    >
      {/* Recipient */}
      <div className="w-[175px] shrink-0 truncate text-[12px] font-medium text-[#303435]">
        To: {recipient}
      </div>

      {/* Date */}
      <div className="shrink-0">
        <span className="inline-flex h-[25px] items-center rounded-full bg-[#FFF0E4] px-3 text-[10px] font-medium text-[#F07832]">
          <ClockSmallIcon />

          <span className="ml-[5px]">
            {date ? formatEmailDate(date) : "--"}
          </span>
        </span>
      </div>

      {/* Subject + preview */}
      <div className="ml-3 min-w-0 flex-1 truncate text-[12px]">
        <span className="font-medium text-[#252829]">
          {subject}
        </span>

        {preview && (
          <>
            <span className="mx-2 text-[#A5AAAB]">
              -
            </span>

            <span className="text-[#9EA3A4]">
              {preview}
            </span>
          </>
        )}
      </div>

      {/* Star */}
      <span
        onClick={(event) => {
          event.stopPropagation();
        }}
        className="ml-5 flex h-8 w-8 shrink-0 items-center justify-center text-[#C4C9CA] transition hover:text-[#777]"
      >
        <StarIcon />
      </span>
    </button>
  );
}
/* ================================================================
   DATE
================================================================ */

function formatEmailDate(date: Date) {
  const now = new Date();

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();

  if (isTomorrow) {
    return `Tomorrow ${date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

/* ================================================================
   EMPTY
================================================================ */

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="flex h-[240px] items-center justify-center">
      <div className="text-center">
        <div className="text-[14px] font-medium text-[#777D7E]">
          No {tab} emails
        </div>

        {tab === "scheduled" && (
          <div className="mt-2 text-[12px] text-[#A8ADAE]">
            Click Compose to schedule your first campaign.
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   LOADING
================================================================ */

function LoadingRows() {
  return (
    <div>
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="flex h-[60px] items-center border-b border-[#F0F1F1] px-7"
        >
          <div className="h-3 w-[130px] animate-pulse rounded bg-[#F0F2F2]" />

          <div className="ml-[45px] h-6 w-[85px] animate-pulse rounded-full bg-[#F4F5F5]" />

          <div className="ml-3 h-3 flex-1 animate-pulse rounded bg-[#F4F5F5]" />
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   ICONS
================================================================ */

function SearchIcon() {
  return (
    <svg
      className="absolute left-4 top-[12px]"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="#9EA6A8"
        strokeWidth="1.5"
      />
      <path
        d="M16 16L21 21"
        stroke="#9EA6A8"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M4 6H20L14 13V19L10 21V13L4 6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M20 11A8 8 0 1 0 18 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M20 5V11H14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="#647473"
        strokeWidth="1.5"
      />

      <path
        d="M12 8V12L15 14"
        stroke="#647473"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockSmallIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
      />

      <path
        d="M12 8V12L15 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M21 3L10 14"
        stroke="#647473"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="M21 3L14 21L10 14L3 10L21 3Z"
        stroke="#647473"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M12 3.5L14.63 8.83L20.5 9.68L16.25 13.83L17.25 19.68L12 16.92L6.75 19.68L7.75 13.83L3.5 9.68L9.37 8.83L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M7 10L12 15L17 10"
        stroke="#9AA0A3"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}