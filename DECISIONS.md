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
