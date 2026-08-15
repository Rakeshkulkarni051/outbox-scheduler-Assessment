"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

export default function HomePage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const handleGoogleLogin = () => {
    signIn("google", {
      callbackUrl: "/dashboard",
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-[340px] rounded-[8px] border border-[#E2E5E8] bg-white px-[39px] py-[36px]">
        {/* Login heading */}
        <h1 className="mb-[19px] text-center text-[27px] font-semibold leading-[32px] text-[#202020]">
          Login
        </h1>

        {/* Google Login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={status === "loading"}
          className="flex h-[33px] w-full items-center justify-center gap-[8px] rounded-[8px] bg-[#E3F5EC] text-[11px] font-medium text-[#333333] transition-colors hover:bg-[#D9F0E5] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon />

          <span>
            {status === "loading" ? "Checking session..." : "Login with Google"}
          </span>
        </button>

        {/* Divider */}
        <div className="my-[16px] flex items-center">
          <div className="h-px flex-1 bg-[#ECECEC]" />

          <span className="px-[10px] text-[9px] leading-none text-[#B4B4B4]">
            or sign up through email
          </span>

          <div className="h-px flex-1 bg-[#ECECEC]" />
        </div>

        {/* Email */}
        <input
          type="email"
          placeholder="Email ID"
          disabled
          className="mb-[8px] h-[39px] w-full rounded-[8px] border-0 bg-[#F3F5F5] px-[14px] text-[10px] text-[#666666] outline-none placeholder:text-[#777D83]"
        />

        {/* Password */}
        <input
          type="password"
          placeholder="Password"
          disabled
          className="mb-[19px] h-[39px] w-full rounded-[8px] border-0 bg-[#F3F5F5] px-[14px] text-[10px] text-[#666666] outline-none placeholder:text-[#777D83]"
        />

        {/* Email Login - visual only because authentication is Google OAuth */}
        <button
          type="button"
          disabled
          className="h-[33px] w-full cursor-not-allowed rounded-[8px] bg-[#00AF4F] text-[11px] font-medium text-white opacity-100"
        >
          Login
        </button>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />

      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
      />

      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
      />

      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  );
}