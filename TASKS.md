# Tasks

## To Do

### Going live
- [ ] Set up a "forgot password" page and a proper sign-up confirmation page

### Portal stage 2 – Entries, cart, payments and receipts
- [ ] Rick: add the payment keys in Vercel and try a test payment with each of Square and PayPal
- [ ] Payment "webhooks" as a backup, so a payment is recorded even if the competitor closes the page before returning
- [ ] Refunds (done in Square/PayPal for now; show them in the portal later)
- [ ] Organiser: see paid and unpaid carts for an event
- [ ] Organiser: number all un-numbered entries in one click
- [ ] Organiser chooses what competitor accounts are allowed to do
- [ ] Filter competitions by date, location, age and genre (once there are several)

### Portal stage 3 – Music
- [ ] Competitors upload music per entry and confirm it is correct
- [ ] Organiser sees which entries have usable music
- [ ] Download a day's music as an ordered playlist ("event pack")

### Portal stage 4 – Critiques and reports
- [ ] Upload critiques and file them in each competitor's folder
- [ ] Upload a missing critique directly to a competitor
- [ ] Downloadable reports and a printable published program

### Venue tools
- [ ] Music playback (sound desk), offline
- [ ] Voice critique recording (adjudicator), offline, with scores

### Ideas noticed along the way
- [ ] Organisers sign up themselves and pay Inspire a fee (how they pay is still to be decided)
- [ ] Move a whole section earlier or later in the running order
- [ ] Clear a whole program in one step (for re-importing a corrected CSV)
- [ ] Invite staff by email when they don't have an account yet

## In Progress

## Done
- [x] 2026-11-26 – Payments (test mode): Square and PayPal checkout, payment checked with Square/PayPal before marking paid, paid items go into the program, receipt page with logo and My receipts, 9 payment tests and 1 more security test
- [x] 2026-11-26 – Rick's changes: studio entries with just a studio name, no routine title when entering, organisers can open or close entries by hand
- [x] 2026-11-26 – Stage 2 part 1: dancers (name, date of birth, studio), entering published events, cart with age and dancer-count checks, entries open/close on the event dates, section age and dancer limits, "ages as at" date, 3 more security tests
- [x] 2026-11-26 – Portal live at https://inspire-media-tau.vercel.app; Rick signed in as Inspire admin. Fixed: plain message when settings are missing, accept either Supabase address, no sign-in loop without a profile, explicit database access grants for newer Supabase projects
- [x] 2026-11-25 – Read the brief and requirements; agreed build order, many organisers, hosting, Square, and repository
- [x] 2026-11-25 – Stage 1: website skeleton with the Inspire logo theme, logins, Inspire admin page, organisers and staff, events, sessions and sections, program CSV import, online program editing (edit, scratch, reorder, late entries), public event page, program CSV download, sample data, and automatic security tests
