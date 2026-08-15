"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useSession } from "next-auth/react";

import { useScheduledEmails } from "@/hooks/useScheduledEmails";
import { useSentEmails } from "@/hooks/useSentEmails";

export default function EmailDetailPage() {
  const router = useRouter();
const params = useParams();
const searchParams = useSearchParams();
const { data: session } = useSession();

const scheduled = useScheduledEmails();
const sent = useSentEmails();

const id = String(params.id);
const tab = searchParams.get("tab");

  const email = useMemo(() => {
    const allEmails = [
      ...scheduled.emails,
      ...sent.emails,
    ];

    return allEmails.find(
      (item: any) => String(item.id) === String(id)
    );
  }, [scheduled.emails, sent.emails, id]);

  const displayName =
    session?.user?.name?.trim() || "Oliver Brown";

  const avatar =
    session?.user?.image ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      displayName
    )}&background=E5E7EB&color=555555&size=80`;

  const loading =
    scheduled.loading || sent.loading;

  /*
   * Email wasn't found yet because the API may still be loading.
   */
  if (loading && !email) {
    return (
      <main className="min-h-screen bg-white">
        <EmailHeader
          subject="Loading email..."
          avatar={avatar}
          onBack={() => router.back()}
        />

        <div className="mx-auto mt-16 w-full max-w-[900px] px-6">
          <div className="h-5 w-48 animate-pulse rounded bg-[#F1F3F3]" />
          <div className="mt-8 h-4 w-32 animate-pulse rounded bg-[#F4F5F5]" />
          <div className="mt-8 h-4 w-full animate-pulse rounded bg-[#F4F5F5]" />
          <div className="mt-3 h-4 w-5/6 animate-pulse rounded bg-[#F4F5F5]" />
        </div>
      </main>
    );
  }

  /*
   * No email found.
   */
  if (!email) {
    return (
      <main className="min-h-screen bg-white">
        <EmailHeader
          subject="Email not found"
          avatar={avatar}
          onBack={() => router.back()}
        />

        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <p className="text-[15px] font-medium text-[#555]">
              Email not found
            </p>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-4 text-[13px] text-[#00A94F] hover:underline"
            >
              Return to dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  const recipient =
    (email as any).recipient || "Unknown recipient";

  const subject =
    (email as any).subject || "No subject";

  const body =
    (email as any).body || "";

  const senderName =
    (email as any).sender?.name ||
    (email as any).senderName ||
    "Sender";

  const senderEmail =
    (email as any).sender?.email ||
    (email as any).senderEmail ||
    "";

  const dateValue =
    tab === "sent"
      ? (email as any).sentTime
      : (email as any).scheduledTime;

  const emailDate = dateValue
    ? new Date(dateValue)
    : null;

  const senderAvatar =
    (email as any).sender?.image ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      senderName
    )}&background=00AF4F&color=ffffff&size=80`;

  return (
    <main className="min-h-screen w-full bg-white text-[#202124]">

      {/* =========================================================
          TOP HEADER
      ========================================================= */}
      <EmailHeader
        subject={subject}
        avatar={avatar}
        onBack={() => router.back()}
      />

      {/* =========================================================
          EMAIL CONTENT
      ========================================================= */}
      <article className="mx-auto w-full max-w-[1120px] px-6 pb-16 pt-7 lg:px-10">

        {/* Sender row */}
        <div className="flex items-start">

          {/* Sender avatar */}
          <img
            src={senderAvatar}
            alt=""
            className="h-[34px] w-[34px] shrink-0 rounded-full object-cover"
          />

          {/* Sender information */}
          <div className="ml-3 min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">

              <span className="text-[13px] font-semibold text-[#202124]">
                {senderName}
              </span>

              {senderEmail && (
                <span className="text-[10px] text-[#7B8387]">
                  &lt;{senderEmail}&gt;
                </span>
              )}
            </div>

            {/* To me */}
            <div className="mt-[4px] flex items-center gap-1 text-[9px] text-[#7D8589]">
              <span>to me</span>

              <ChevronDownSmall />
            </div>
          </div>

          {/* Date */}
          {emailDate && (
            <div className="pt-[4px] text-[10px] text-[#7C858A]">
              {formatFullDate(emailDate)}
            </div>
          )}
        </div>

        {/* =======================================================
            BODY
        ======================================================= */}
        <div className="ml-[47px] mt-7 max-w-[850px]">

          {renderEmailBody(body)}

        </div>

      </article>
    </main>
  );
}

/* ================================================================
   HEADER
================================================================ */

function EmailHeader({
  subject,
  avatar,
  onBack,
}: {
  subject: string;
  avatar: string;
  onBack: () => void;
}) {
  return (
    <header className="flex h-[68px] w-full items-center border-b border-[#F1F2F2] px-5">

      {/* Left */}
      <div className="flex min-w-0 flex-1 items-center">

        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#50575A] transition hover:bg-[#F4F5F5]"
        >
          <BackIcon />
        </button>

        <h1 className="truncate text-[17px] font-normal text-[#25292A]">
          {subject}
        </h1>
      </div>

      {/* Right actions */}
      <div className="ml-4 flex shrink-0 items-center gap-5">

        <button
          type="button"
          aria-label="Star"
          className="text-[#B6BDC0] transition hover:text-[#666]"
        >
          <HeaderStarIcon />
        </button>

        <button
          type="button"
          aria-label="Archive"
          className="text-[#B6BDC0] transition hover:text-[#666]"
        >
          <ArchiveIcon />
        </button>

        <button
          type="button"
          aria-label="Delete"
          className="text-[#B6BDC0] transition hover:text-[#666]"
        >
          <TrashIcon />
        </button>

        <img
          src={avatar}
          alt=""
          className="h-[28px] w-[28px] rounded-full object-cover"
        />
      </div>
    </header>
  );
}

/* ================================================================
   EMAIL BODY
================================================================ */

function renderEmailBody(body: string) {
  /*
   * If your backend eventually stores actual HTML email bodies,
   * this can be changed to a sanitized HTML renderer.
   *
   * For the current assignment, the backend stores the body as
   * the email body string, so preserving line breaks is safest.
   */

  const lines = body.split(/\r?\n/);

  return (
    <div className="text-[12px] leading-[1.8] text-[#34393B]">

      {lines.map((line, index) => {
        if (!line.trim()) {
          return (
            <div
              key={index}
              className="h-3"
            />
          );
        }

        return (
          <p key={index}>
            {line}
          </p>
        );
      })}

    </div>
  );
}

/* ================================================================
   DATE
================================================================ */

function formatFullDate(date: Date) {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ================================================================
   ICONS
================================================================ */

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
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownSmall() {
  return (
    <svg
      width="9"
      height="9"
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

function HeaderStarIcon() {
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

function ArchiveIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M4 7H20V19H4V7Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      <path
        d="M3 4H21V7H3V4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      <path
        d="M9 11H15"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M5 7H19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="M10 11V17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="M14 11V17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="M6 7L7 20H17L18 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <path
        d="M9 7V4H15V7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}