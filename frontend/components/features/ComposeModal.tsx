import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
// TODO: import Papa from "papaparse" to parse the uploaded recipient list
// and show a detected-address count, per the assignment's compose spec.

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { subject: string; body: string }) => void;
}

export function ComposeModal({ open, onClose, onSubmit }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  return (
    <Modal open={open} onClose={onClose} title="Compose new email">
      <div className="space-y-3">
        <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea
          placeholder="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm h-32"
        />
        {/* TODO: CSV/text upload for recipients, start time, delay, hourly limit fields */}
        <Button onClick={() => onSubmit({ subject, body })}>Schedule</Button>
      </div>
    </Modal>
  );
}
