"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function Refresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <button
      className="rounded-lg bg-slate-200 hover:bg-slate-300 text-black px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
      onClick={handleRefresh}
      disabled={isPending}
    >
      {isPending ? "Loading..." : "Refresh"}
    </button>
  );
}
