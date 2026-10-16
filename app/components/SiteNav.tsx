"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Lineup Helper", isActive: (p: string) => p === "/" || p.startsWith("/team") },
  { href: "/records", label: "All-Time Records", isActive: (p: string) => p.startsWith("/records") },
];

export const SiteNav = () => {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-2">
      {LINKS.map(({ href, label, isActive }) => (
        <Link
          key={href}
          href={href}
          className={`rounded-lg px-2 py-1 ${
            isActive(pathname)
              ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-black"
              : "hover:bg-slate-200 dark:hover:bg-slate-800"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
};
