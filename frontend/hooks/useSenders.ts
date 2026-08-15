import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";
import type { Sender } from "@/types";

export function useSenders() {
  const { data: session, status } = useSession();
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated" || !session?.idToken) return;
    api
      .getSenders(session.idToken)
      .then(setSenders)
      .finally(() => setLoading(false));
  }, [status, session?.idToken]);

  return { senders, loading };
}
