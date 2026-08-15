interface Props {
  message: string;
  variant?: "success" | "error";
  onDismiss: () => void;
}

export function Toast({ message, variant = "success", onDismiss }: Props) {
  const styles =
    variant === "success"
      ? "bg-green-50 text-green-800 border-green-200"
      : "bg-red-50 text-red-800 border-red-200";

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-md border px-4 py-3 text-sm shadow-md ${styles}`}
    >
      <span>{message}</span>
      <button onClick={onDismiss} className="text-current opacity-60 hover:opacity-100">
        ✕
      </button>
    </div>
  );
}
