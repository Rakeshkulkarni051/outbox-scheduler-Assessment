import { Table } from "@/components/ui/Table";
import type { EmailRecord } from "@/types";

interface Props {
  emails: EmailRecord[];
  loading: boolean;
}

export function SentEmailsTable({ emails, loading }: Props) {
  return (
    <Table<EmailRecord>
      rows={emails}
      loading={loading}
      rowKey={(e) => e.id}
      emptyMessage="No emails sent yet."
      columns={[
        { header: "Email", render: (e) => e.recipient },
        { header: "Subject", render: (e) => e.campaign.subject },
        { header: "Sent time", render: (e) => (e.sentTime ? new Date(e.sentTime).toLocaleString() : "—") },
        { header: "Status", render: (e) => e.status },
      ]}
    />
  );
}
