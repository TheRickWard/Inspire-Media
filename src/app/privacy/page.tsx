import type { Metadata } from "next";
import Link from "next/link";
import { card, h1, h2, link, muted } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy and terms – Inspire Media" };

// DRAFT written for Inspire Media. Have it checked by someone qualified before relying on it.
const business = process.env.RECEIPT_BUSINESS_NAME?.trim() || "Inspire Dance & Fitness";
const abn = process.env.RECEIPT_ABN?.trim();
const contact = process.env.CONTACT_EMAIL?.trim();
const UPDATED = "27 November 2026";

function Contact() {
  return contact ? <a href={`mailto:${contact}`} className={link}>{contact}</a> : <>the contact email on the competition&apos;s page</>;
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className={h1}>Privacy and terms</h1>
        <p className={muted}>
          {business}{abn ? ` · ABN ${abn}` : ""} · Last updated {UPDATED}
        </p>
      </div>

      <section className={`${card} space-y-3 text-sm leading-relaxed text-slate-700`}>
        <h2 className={h2}>Privacy policy</h2>
        <p>
          This portal is run by {business} (&quot;we&quot;) to manage dance competitions and eisteddfods. We follow the Australian Privacy Principles in the Privacy Act 1988 (Cth).
        </p>

        <h3 className="font-semibold text-brand-ink">What we collect</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Your account:</strong> your name, email address and password (stored scrambled; we can&apos;t read it).</li>
          <li><strong>Dancers you add:</strong> name, date of birth and dance studio. Dates of birth are only used to check age groups.</li>
          <li><strong>Studio entries:</strong> only the studio name. No children&apos;s details are needed.</li>
          <li><strong>Entries and payments:</strong> what you entered, what you paid, the payment reference and your receipt. Card and PayPal details are entered on Square&apos;s or PayPal&apos;s own secure pages. We never see or store them.</li>
          <li><strong>Music</strong> you upload for your entries, and (when available) adjudicators&apos; critiques of performances.</li>
        </ul>

        <h3 className="font-semibold text-brand-ink">Children</h3>
        <p>
          Dancers are usually children. Their details must be added by a parent, guardian or their dance studio with the parent&apos;s permission. We only collect what&apos;s needed to run the competition, and we never sell it or use it for advertising.
        </p>

        <h3 className="font-semibold text-brand-ink">Who can see it</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>The organiser of a competition you enter</strong> sees your entries, the dancers in them, your name and email (so they can contact you), payments and music for that competition only.</li>
          <li><strong>The public</strong> sees a published program: performer names, studio names and item numbers. Dates of birth are never shown publicly.</li>
          <li><strong>Our service providers</strong> who host the portal and process payments: Supabase (database and file storage), Vercel (website hosting), Square and PayPal (payments). Some of these may store data outside Australia.</li>
        </ul>

        <h3 className="font-semibold text-brand-ink">How long we keep it</h3>
        <p>
          We keep entries, receipts and payment records for as long as Australian tax law requires (usually 5 years). Music files may be removed after the competition. You can delete dancers who have no paid entries yourself at any time.
        </p>

        <h3 className="font-semibold text-brand-ink">Your choices</h3>
        <p>
          You can ask to see, correct or delete your information, or make a privacy complaint, by emailing <Contact />. We&apos;ll reply within 30 days. If you&apos;re not happy with our answer you can contact the Office of the Australian Information Commissioner (oaic.gov.au).
        </p>
      </section>

      <section className={`${card} space-y-3 text-sm leading-relaxed text-slate-700`}>
        <h2 className={h2}>Terms of use</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Accounts:</strong> keep your password private. You&apos;re responsible for entries made from your account, and the details you give must be true (including dancers&apos; dates of birth).</li>
          <li><strong>Entries:</strong> each competition is run by its organiser, whose rules, age groups and closing dates apply. An entry is only confirmed once it&apos;s paid.</li>
          <li><strong>Payments and refunds:</strong> entry fees are set by the organiser and paid in Australian dollars through Square or PayPal. Refunds are at the organiser&apos;s discretion under their competition rules, and as required by Australian Consumer Law.</li>
          <li><strong>Music:</strong> only upload music you&apos;re allowed to use, suitable for the age of the dancers. Please check it plays correctly before the due date.</li>
          <li><strong>Critiques and results</strong> are the opinion of the adjudicator and are final, as set out in each competition&apos;s rules.</li>
          <li><strong>Behaviour:</strong> don&apos;t misuse the portal, try to access other people&apos;s information, or upload anything harmful. We may close accounts that do.</li>
          <li><strong>Changes:</strong> we may update these terms. The date at the top shows the latest version.</li>
        </ul>
      </section>

      <p className={muted}>
        Questions? Email <Contact />. <Link href="/" className={link}>Back to home</Link>
      </p>
    </div>
  );
}
