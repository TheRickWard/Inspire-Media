"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Keeps "where to go after signing in" (?next=/enter/…) when moving between sign-in and sign-up. */
export function ReturnToField() {
  const next = useSearchParams().get("next");
  return next ? <input type="hidden" name="next" value={next} /> : null;
}

export function ReturnToLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  const next = useSearchParams().get("next");
  return (
    <Link href={next ? `${href}?next=${encodeURIComponent(next)}` : href} className={className}>
      {children}
    </Link>
  );
}
