import { ShieldAlert } from "lucide-react";

export function Forbidden() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white px-6 py-16 text-center">
      <ShieldAlert className="size-10 text-ink/30" />
      <p className="text-lg font-bold">You don&apos;t have access to this page</p>
      <p className="text-sm text-ink/60">Ask a Super Admin to grant your role the required permission.</p>
    </div>
  );
}
