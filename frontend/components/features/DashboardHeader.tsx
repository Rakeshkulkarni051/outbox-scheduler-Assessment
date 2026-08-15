"use client";

import { signOut, useSession } from "next-auth/react";

export function DashboardHeader() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
      <span className="font-semibold">Outbox Scheduler</span>
      <div className="flex items-center gap-3 text-sm text-gray-600">
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={user.name ?? "User avatar"} className="h-8 w-8 rounded-full" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-700">
            {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="hidden sm:block text-right leading-tight">
          <div className="font-medium text-gray-800">{user?.name ?? "—"}</div>
          <div className="text-xs text-gray-400">{user?.email ?? ""}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
