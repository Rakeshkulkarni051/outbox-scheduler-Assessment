import "./globals.css";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/providers/AuthProvider";

export const metadata = {
  title: "Outbox Scheduler",
  description: "Email job scheduler dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
