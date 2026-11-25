import Link from "next/link";
import { h1, link, muted } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-12 text-center">
      <h1 className={h1}>Page not found</h1>
      <p className={muted}>This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className={link}>Go to the home page</Link>
    </div>
  );
}
