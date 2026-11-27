import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { card, h1, input, label, link, muted } from "@/components/ui";
import { setNewPassword } from "@/app/auth/actions";

async function ResetForm() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <p className={muted}>
        This page opens from the link in your reset email. <Link href="/forgot-password" className={link}>Ask for a new link</Link>.
      </p>
    );
  }
  return (
    <div className={card}>
      <p className="mb-4 text-sm text-slate-600">Choosing a new password for <span className="font-medium">{user.email}</span>.</p>
      <ActionForm action={setNewPassword} submitLabel="Save new password" pendingLabel="Saving…">
        <div>
          <label htmlFor="password" className={label}>New password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className={input} />
          <p className={`${muted} mt-1`}>At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="confirm" className={label}>Type it again</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className={input} />
        </div>
      </ActionForm>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className={h1}>Choose a new password</h1>
      <Suspense fallback={<p className={muted}>Loading…</p>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
