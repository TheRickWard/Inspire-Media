import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ActionForm";
import { card, h1, input, label, link, muted } from "@/components/ui";
import { requestPasswordReset } from "@/app/auth/actions";

async function ExpiredNote({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const { link: state } = await searchParams;
  if (state !== "expired") return null;
  return (
    <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
      That reset link has expired or was opened in a different browser. Please ask for a new one below.
    </p>
  );
}

export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className={h1}>Forgot your password?</h1>
        <p className={`${muted} mt-1`}>Enter your email and we&apos;ll send you a link to choose a new one.</p>
      </div>
      <Suspense>
        <ExpiredNote searchParams={searchParams as Promise<{ link?: string }>} />
      </Suspense>
      <div className={card}>
        <ActionForm action={requestPasswordReset} submitLabel="Send reset link" pendingLabel="Sending…">
          <div>
            <label htmlFor="email" className={label}>Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className={input} />
          </div>
        </ActionForm>
      </div>
      <p className={muted}>
        Remembered it? <Link href="/login" className={link}>Back to sign in</Link>
      </p>
    </div>
  );
}
