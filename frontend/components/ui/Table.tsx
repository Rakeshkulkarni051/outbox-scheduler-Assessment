interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyMessage?: string;
  rowKey: (row: T) => string;
}

// Generic, reusable table — ScheduledEmailsTable and SentEmailsTable both
// configure this with their own columns instead of duplicating markup.
export function Table<T>({ columns, rows, loading, emptyMessage = "Nothing here yet.", rowKey }: Props<T>) {
  if (loading) return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  if (rows.length === 0) return <div className="p-6 text-sm text-gray-500">{emptyMessage}</div>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b">
          {columns.map((col) => (
            <th key={col.header} className="py-2 px-3 font-medium">
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="border-b last:border-0">
            {columns.map((col) => (
              <td key={col.header} className="py-2 px-3">
                {col.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
