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
**Why:** Matches how eisteddfods usually run, and keeps as little information about children as possible. (Card sent to Rick to confirm.)

## 2026-11-26 – Entries are created when paid
**Decision:** Entries sit in a cart until paid. Only paid cart items become program entries, without an item number until the organiser numbers the program. Nobody can mark a cart paid or change a fee directly; only the database's own checks can.
**Why:** Keeps the program free of unpaid entries and stops fee tampering.

## 2026-11-26 – Newer Supabase projects need explicit access grants
**Decision:** Every database change file grants the website access to new tables and functions explicitly.
**Why:** The live Supabase project doesn't grant access by default (found while going live).
