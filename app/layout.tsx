import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { SiteNav } from "./components/SiteNav";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "SBBHL",
  description: "Super Best Buds Hockey League",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased mx-auto p-4 min-h-screen flex flex-col text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 font-mono`}
      >
        <div className="max-w-8xl w-full mx-auto sm:px-6 md:px-8 flex-1">
          <nav className="flex flex-col gap-2 items-start mb-4">
            <h1 className="text-3xl font-bold">SBBHL</h1>
            <SiteNav />
          </nav>
          {children}
        </div>
        <footer className="sticky bottom-0 -mx-4 -mb-4 mt-8 px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
          <div className="max-w-8xl mx-auto sm:px-6 md:px-8">
            <Link href="/overages" className="hover:underline">
              Overages
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
