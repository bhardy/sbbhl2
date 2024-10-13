"use client";

import { useRouter } from "next/navigation";

export function Refresh() {
  const router = useRouter();
  return (
    <button
      className="rounded-lg bg-slate-200 hover:bg-slate-300 text-black px-2 py-1"
      onClick={() => router.refresh()}
    >
      Refresh
    </button>
  );
}
