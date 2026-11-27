import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ActionForm";
import { ReturnToField, ReturnToLink } from "@/components/ReturnTo";
import { card, h1, input, label, link, muted } from "@/components/ui";
import { signIn } from "@/app/auth/actions";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className={h1}>Sign in</h1>
      <div className={card}>
        <ActionForm action={signIn} submitLabel="Sign in" pendingLabel="Signing in…">
          <Suspense fallback={null}><ReturnToField /></Suspense>
          <div>
            <label htmlFor="email" className={label}>Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className={input} />
          </div>
          <div>
            <label htmlFor="password" className={label}>Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className={input} />
            <p className="mt-1 text-right text-sm">
              <Link href="/forgot-password" className={link}>Forgot your password?</Link>
            </p>
          </div>
        </ActionForm>
      </div>
      <p className={muted}>
        New here? <Suspense fallback={<Link href="/signup" className={link}>Create an account</Link>}><ReturnToLink href="/signup" className={link}>Create an account</ReturnToLink></Suspense>
      </p>
    </div>
  );
}
