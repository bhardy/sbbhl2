"use client";

import type { ReactNode } from "react";

// The ids of the open game lists, as `?open=<id>,<id>`, so an expanded list can
// be shared by link. The page reads the same param on the server.
const PARAM = "open";

export const GamesDetails = ({
  id,
  defaultOpen,
  summary,
  children,
}: {
  id: string;
  defaultOpen: boolean;
  summary: ReactNode;
  children: ReactNode;
}) => (
  <details
    className="text-sm"
    open={defaultOpen}
    onToggle={(event) => {
      const url = new URL(window.location.href);
      const ids = new Set((url.searchParams.get(PARAM) ?? "").split(",").filter(Boolean));
      if (event.currentTarget.open) ids.add(id);
      else ids.delete(id);
      if (ids.size) url.searchParams.set(PARAM, Array.from(ids).join(","));
      else url.searchParams.delete(PARAM);
      // Leave the commas readable instead of %2C.
      window.history.replaceState(null, "", url.toString().replaceAll("%2C", ","));
    }}
  >
    <summary className="cursor-pointer text-slate-500 dark:text-slate-400">{summary}</summary>
    {children}
  </details>
);
