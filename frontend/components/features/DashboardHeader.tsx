// TODO: pull real user (name, email, avatar) from the NextAuth session
// (`useSession()`), and wire the logout button to `signOut()`.
export function DashboardHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
      <span className="font-semibold">Outbox Scheduler</span>
      <div className="flex items-center gap-3 text-sm text-gray-600">
        {/* avatar / name / email / logout go here */}
      </div>
    </header>
  );
}
