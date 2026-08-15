import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { EmailRecord } from "@/types";

export function useScheduledEmails() {
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getScheduledEmails()
      .then(setEmails)
      .finally(() => setLoading(false));
  }, []);

  return { emails, loading };
}
