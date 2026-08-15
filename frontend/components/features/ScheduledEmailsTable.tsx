import { Table } from "@/components/ui/Table";
import type { EmailRecord } from "@/types";

interface Props {
  emails: EmailRecord[];
  loading: boolean;
}

export function ScheduledEmailsTable({ emails, loading }: Props) {
  return (
    <Table<EmailRecord>
      rows={emails}
      loading={loading}
      rowKey={(e) => e.id}
      emptyMessage="No scheduled emails yet."
      columns={[
        { header: "Email", render: (e) => e.recipient },
        { header: "Subject", render: (e) => e.campaign.subject },
        { header: "Scheduled time", render: (e) => new Date(e.scheduledTime).toLocaleString() },
        { header: "Status", render: (e) => e.status },
      ]}
    />
  );
}
