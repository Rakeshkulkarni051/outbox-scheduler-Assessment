import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";
import type { EmailRecord } from "@/types";

export function useSentEmails() {
  const { data: session, status } = useSession();
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!session?.idToken) return;
    setLoading(true);
    try {
      setEmails(await api.getSentEmails(session.idToken));
    } finally {
      setLoading(false);
    }
  }, [session?.idToken]);

  useEffect(() => {
    if (status === "authenticated") refetch();
  }, [status, refetch]);

  return { emails, loading, refetch };
}
