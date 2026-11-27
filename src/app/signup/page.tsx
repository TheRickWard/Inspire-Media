import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ActionForm";
import { ReturnToField, ReturnToLink } from "@/components/ReturnTo";
import { card, h1, input, label, link, muted } from "@/components/ui";
import { signUp } from "@/app/auth/actions";

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className={h1}>Create an account</h1>
        <p className={`${muted} mt-1`}>
          For competitors, parents and studios. Organisers: create an account, then ask Inspire Media to set up your organisation.
        </p>
      </div>
      <div className={card}>
        <ActionForm action={signUp} submitLabel="Create account" pendingLabel="Creating…">
          <Suspense fallback={null}><ReturnToField /></Suspense>
          <div>
            <label htmlFor="full_name" className={label}>Your name</label>
            <input id="full_name" name="full_name" autoComplete="name" required className={input} />
          </div>
          <div>
            <label htmlFor="email" className={label}>Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className={input} />
          </div>
          <div>
            <label htmlFor="password" className={label}>Password (at least 8 characters)</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className={input} />
          </div>
        </ActionForm>
        <p className={`${muted} mt-3`}>
          By creating an account you agree to our <Link href="/privacy" className={link}>privacy policy and terms</Link>.
        </p>
      </div>
      <p className={muted}>
        Already have an account? <Suspense fallback={<Link href="/login" className={link}>Sign in</Link>}><ReturnToLink href="/login" className={link}>Sign in</ReturnToLink></Suspense>
      </p>
    </div>
  );
}
