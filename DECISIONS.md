# Decisions

Each entry records what was decided, why, and the date.

## 2026-11-25 – Browser-based, not separate native apps
**Decision:** Build everything as web apps that run in a browser. The venue tools will run on Windows laptops and iPads from the same code.
**Why:** One codebase instead of separate Windows and iOS programs. Rick's brief asked for browser-based.

## 2026-11-25 – Build the online portal first
**Decision:** Build the online portal (accounts, events, entries, payments, music upload, critique delivery) before the offline venue tools.
**Why:** Rick's choice. The venue tools will load an "event pack" (program data plus music in running order) that the portal produces.

## 2026-11-25 – Many organisers from day one
**Decision:** The portal supports multiple organisers. Rick's business runs its own events, and other organisers can pay to use the portal with their own login and see only their own competitions. Rick has an overall admin view.
**Why:** Rick plans to offer the portal to other organisers for a fee. Building this in later would mean reworking the database.
**Later:** How other organisers pay Rick (monthly, per event, or a cut of entries) is not decided yet.

## 2026-11-25 – Hosting
**Decision:** Use free starter tiers while building. Rick will pay for hosting once the portal is operational.

## 2026-11-25 – Payments via Square
**Decision:** Take entry payments through Square. Rick has an ABN. Build and test in Square's test mode first; no real money moves until Rick says so.

## 2026-11-25 – Code location
**Decision:** Code lives in the GitHub repository TheRickWard/Inspire-Media.

## 2026-11-25 – Building blocks (approved by Rick)
**Decision:** Next.js + TypeScript + Tailwind for the website; Supabase for the database, logins and file storage; Vercel for hosting; Square's toolkit for payments (stage 2); PapaParse for CSV files; Zod for checking forms.
**Why:** Rick's brief suggested Next.js. Supabase gives a database, logins and file storage in one free-to-start service, can store data in Sydney, and enforces "organisers only see their own data" inside the database itself.

## 2026-11-25 – Theme from the Inspire logo
**Decision:** The portal uses the Inspire Dance & Fitness logo and its colours: white header with the logo, a rainbow stripe, purple buttons with magenta highlights.
**Why:** Rick asked for the logo to be used for all theming.

## 2026-11-25 – How organisers get access
**Decision:** Anyone can create an account. An Inspire admin then creates an organiser and makes an existing account its owner. Owners can add staff (who must have an account).
**Why:** Simple and safe for stage 1. Self-service organiser sign-up with fees can come later.

## 2026-11-25 – Public program shows names
**Decision:** Once an event is published, the public page shows the program overview (sessions, sections and item counts). Performer names are readable by the public database rules for published events, as in a printed program, but the page doesn't list them yet. No contact details or ages of children are stored in the program.
**Why:** Programs are normally public, but many competitors are children. Revisit before showing names publicly.

## 2026-11-25 – Item numbers are text, running order is separate
**Decision:** Item numbers can contain letters (e.g. "45A" for late entries). The running order is stored separately, so items can be moved without renumbering.

## 2026-11-25 – Scratch rather than delete
**Decision:** Withdrawn items are "scratched" and stay in the records. Delete is only for mistakes and asks for confirmation.

## 2026-11-26 – Who enters, and what we keep about dancers
**Decision:** Any account can add dancers and enter them, so parents can enter their own children and studios can enter their whole team. For each dancer we keep only the name, date of birth (to check age groups) and studio. The account holder is the contact.
**Why:** Matches how eisteddfods usually run, and keeps as little information about children as possible. Confirmed by Rick on 2026-11-26.

## 2026-11-26 – Entries are created when paid
**Decision:** Entries sit in a cart until paid. Only paid cart items become program entries, without an item number until the organiser numbers the program. Nobody can mark a cart paid or change a fee directly; only the database's own checks can.
**Why:** Keeps the program free of unpaid entries and stops fee tampering.

## 2026-11-26 – Newer Supabase projects need explicit access grants
**Decision:** Every database change file grants the website access to new tables and functions explicitly.
**Why:** The live Supabase project doesn't grant access by default (found while going live).

## 2026-11-26 – Studio entries need only the studio name
**Decision:** There are two ways to enter. Parents (or studios who want ages checked) pick their saved dancers. A dance studio can instead make a "studio entry" with just the studio name. No dancer names or birth dates are stored for studio entries, so the portal doesn't check ages or dancer numbers for them. Competitors don't give a routine title when entering.
**Why:** Rick asked for this on 2026-11-26. It stores the least information about children. Organisers can still check ages at the venue. Confirmed by Rick on 2026-11-26.

## 2026-11-26 – Organisers can open or close entries by hand
**Decision:** Entries open and close automatically on the event's dates. An organiser (or the Inspire admin) can override this on the event page: "open now", "closed now", or back to automatic.
**Why:** Rick asked for a way to reopen or close entries when needed.

## 2026-11-26 – Square and PayPal
**Decision:** Checkout offers two ways to pay: Square (cards, Apple Pay, Google Pay) and PayPal. Both are set up in test mode first. Keys go in Vercel's environment variables, never in chat or the code. Each paid cart records which provider was used and its payment reference, so payments can be matched up in either account.
**Why:** Rick asked for PayPal as well as Square on 2026-11-26.

## 2026-11-26 – How online payments work
**Decision:** Competitors pay on Square's or PayPal's own secure page (we never see card details). When they come back, the website asks Square or PayPal directly whether the money arrived and how much, and only then marks the cart paid. Paying puts each item into the organiser's program (no item number yet) and gives a receipt number like INS-1001. Changing the cart after starting a payment cancels that payment attempt, so the amount paid always matches the cart. Only the website's server key can mark a cart paid. No new libraries: the website talks to Square and PayPal directly.
**Why:** Safest and simplest option. No card data on our site, and nothing a competitor does in their browser can mark a cart paid.
**Note:** For now all payments go into Inspire's own Square and PayPal accounts, including for other organisers' events. Paying other organisers out (or connecting their own accounts) is a later decision.

## 2026-11-26 – Numbering entries
**Decision:** The Program page has two buttons. "Number new entries only" keeps every existing number and gives each new entry the number of the item before it plus a letter (12A, 12B…), so numbers already sent out don't change. "Renumber the whole program" numbers everything 1, 2, 3… in running order (it asks first, because existing numbers change). Scratched items keep their place and get a number.
**Why:** Rick asked for numbering in one click. Late online entries are common after a program is shared, so the safe option is offered first.

## 2026-11-26 – Backup for payments (webhooks)
**Decision:** Square and PayPal also notify the website directly when someone pays. The website checks the notification is genuinely from Square/PayPal (signature check), then asks them what was paid, the same as when the competitor comes back. Organisers can also press "Check with Square/PayPal" on an unpaid cart.
**Why:** Rick asked for a backup so payments aren't missed if someone closes the page before returning.

## 2026-11-27 – Music upload
**Decision:** One music file per entry: MP3, M4A or WAV, up to 20 MB. Files are private (only the person who entered and the event's organisers can play them). Competitors can upload or replace music until the event's "Music upload due" date (or the last day of the event if none is set); organisers can always upload or replace. The file goes straight from the browser to storage using a one-off link the website hands out after checking who you are. The organiser's "Download all music" builds one zip in the browser, named in running order ("003 - Item 12A - Jane Jones.mp3"), for the whole event or one session. No new libraries (the zip is made by a small piece of our own code).
**Why:** Rick chose music as stage 3. Uploading straight to storage avoids Vercel's small upload limit, and zipping in the browser avoids Vercel's download size limit.
**Note:** Supabase's free plan stores about 1 GB in total. Rick will buy more storage before a real event.

## 2026-11-27 – Password reset, and Privacy and terms
**Decision:** "Forgot your password?" on the sign-in page emails a reset link (it gives the same answer whether or not the email has an account, so it doesn't reveal who's signed up). The link must be opened in the same browser it was requested from. A draft Privacy and terms page is linked in the footer and on sign-up; it is written for Australian privacy law but is a draft until Rick has it checked.
**Why:** Rick asked for these in the gap check (27 Nov). The site holds children's names and dates of birth and takes payments.
