import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inspire Media – Competition Portal",
  description: "Entries, programs, music and critiques for dance eisteddfods and competitions.",
};

async function AccountLinks() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex items-center gap-4 text-sm font-medium">
        <Link href="/login" className="hover:underline">Sign in</Link>
        <Link href="/signup" className="rounded-md bg-brand-purple px-3 py-1.5 font-medium text-white hover:bg-brand-purple-dark">
          Create account
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 text-sm font-medium">
      {user.isPlatformAdmin && <Link href="/admin" className="hover:underline">Admin</Link>}
      <Link href="/dashboard" className="hover:underline">My dashboard</Link>
      <span className="hidden text-slate-500 sm:inline">{user.fullName || user.email}</span>
      <form action="/auth/signout" method="post">
        <button className="hover:underline">Sign out</button>
      </form>
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="bg-white text-brand-ink shadow-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="shrink-0" aria-label="Inspire home">
              <Image src="/inspire-logo.png" alt="Inspire Dance & Fitness" width={480} height={352} priority className="h-14 w-auto" />
            </Link>
            <Suspense fallback={<div className="h-6" />}>
              <AccountLinks />
            </Suspense>
          </div>
          <div className="brand-rainbow h-1" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          Inspire Media competition portal
        </footer>
      </body>
    </html>
  );
}
