# Tasks

## To Do

### Going live
- [ ] Rick: confirm 20261126030000_number_entries.sql was run live (the Program page's numbering buttons give an error if not)
- [ ] Rick: confirm a password reset link opens the "Choose a new password" page (needs the URL Configuration below)
- [ ] Rick: in Supabase > Authentication > URL Configuration, set Site URL to the live address and add https://inspire-media-tau.vercel.app/** to Redirect URLs (needed for reset links)
- [ ] Have the Privacy and terms page checked; add CONTACT_EMAIL in Vercel
- [ ] Set up a custom email sender in Supabase (the built-in one only sends a few emails an hour)
- [ ] Switch Square and PayPal to live keys

### Portal stage 2 – Entries, cart, payments and receipts
- [x] Refunds in the portal: owners/admin refund from the receipt (back through Square/PayPal, or recorded if paid back another way), can scratch the entries; shown on receipts, Payments and Reports
- [ ] Rick to run `20261128020000_refunds.sql` in the Supabase SQL Editor
- [ ] Organiser chooses what competitor accounts are allowed to do
- [ ] Filter competitions by date, location, age and genre (once there are several)

### Portal stage 3 – Music
- [ ] Upgrade Supabase storage before a real event (free plan holds about 1 GB)
- [ ] Email reminders to competitors who haven't uploaded music
- [ ] Check a track's length and warn if it's over the section's time limit

### Portal stage 4 – Critiques and reports
- [x] Upload critiques and file them in each competitor's folder (Critiques tab: bulk upload matched by item number in the file name)
- [x] Upload a missing critique directly to a competitor ("Add critique" on any entry)
- [x] Release button: whole competition or one session at a time; competitors play/download under My entries
- [ ] Rick to run `20261128010000_voice_critiques.sql` in the Supabase SQL Editor
- [x] Downloadable reports (Reports tab: entries, studios, payments as CSV; summary by section and studio)
- [x] Printable program (by session and section; public once published, organisers can print drafts)

### Venue tools
- [x] Music playback (sound desk), offline: installable web app at /player (see Done)
- [ ] Rick: try the Sound Desk player on the sound-desk Windows laptop and on an iPad (install it, load a music zip, then turn Wi-Fi off and play)
- [ ] Voice critique recording (adjudicator), offline, with scores

### Ideas noticed along the way
- [ ] Sound Desk: choose the sound output (e.g. USB sound card) inside the app on Windows; on iPad it's chosen in Control Centre
- [ ] Ask competitors for a music title when they upload music (needs a database change)
- [ ] Sound Desk: section headings in the list
- [ ] Sound Desk: played log (what played when) saved as a spreadsheet
- [ ] Organisers sign up themselves and pay Inspire a fee (how they pay is still to be decided)
- [ ] Move a whole section earlier or later in the running order
- [ ] Clear a whole program in one step (for re-importing a corrected CSV)
- [ ] Invite staff by email when they don't have an account yet

## In Progress

## Done

- [x] 2026-11-28 – Player renamed "Inspire MediaPlay" (title, heading, app name; "MediaPlay" under the icon)
- [x] 2026-11-28 – Sound Desk: music check on import: every song (list and USB) is opened and measured; empty, unplayable or very short (under 5 s) songs are highlighted red, and a "Music check" box under the USB panel lists them
- [x] 2026-11-28 – Sound Desk: Scratch button on each song: greyed out and crossed through, can't be played, skipped by "Play next", Unscratch puts it back
- [x] 2026-11-28 – Sound Desk: Fade out button (3 seconds, big player and USB player), search box for the list, song lengths (time limit removed 28 Nov at Rick's request), played songs highlighted in Inspire blue
- [x] 2026-11-28 – Sound Desk: USB / folder panel on the left plays music straight from a USB stick or folder without adding it to the list, with its own small player (still only one song at a time)
- [x] 2026-11-28 – Music download names are now "003 - Competitor - Section - Music title" (title only if set); Sound Desk player shows competitor and section and still reads older zips
- [x] 2026-11-28 – Sound Desk player (offline, installable web app at /player): loads the portal's music zip (or files from a folder/USB) in running order, big Play/Pause/Stop/Back to start, other songs locked while one is playing, volume slider, "Play next", late music placed by item number, music kept on the device so it works with no internet; link on the organiser Music tab; 9 player tests
- [x] 2026-11-28 – Fixed: the home page showed "No competitions are published yet" to signed-out visitors on the live site (it asked for organisation names, which visitors can't read). Added `npm run db:live-grants` so local tests use live-style permissions
- [x] 2026-11-28 – Checkout opens Square/PayPal in a new tab; the cart tab shows the receipt once paid

- [x] 2026-11-27 – One cart for several competitions: a Cart page pays for every competition in one Square/PayPal payment; each competition still gets its own receipt

- [x] 2026-11-27 – Forgot password / choose new password pages; Enter button on public event pages; sign-in returns you to the page you were on; draft Privacy and terms page linked in the footer and sign-up

- [x] Stage 3: competitors upload/replace/play music per paid entry (My entries and music); organiser Music tab shows uploaded/missing, plays and uploads tracks, and downloads the music as one zip in running order (whole event or per session)
- [x] 2026-11-26 – Payment backup: Square and PayPal notifications (webhooks) record a payment even if the competitor closes the page; organisers can "Check with Square/PayPal" on unpaid carts
- [x] 2026-11-26 – Item numbers in one click on the Program page: number only new entries (12A, 12B…) or renumber the whole program 1, 2, 3…
- [x] 2026-11-26 – Organiser "Payments" tab per event: money received (by Square/PayPal), paid carts with receipts and contact, unpaid carts
- [x] 2026-11-26 – Rick made test payments with Square and PayPal on the live site (both worked)
- [x] 2026-11-26 – Payments (test mode): Square and PayPal checkout, payment checked with Square/PayPal before marking paid, paid items go into the program, receipt page with logo and My receipts, 9 payment tests and 1 more security test
- [x] 2026-11-26 – Rick's changes: studio entries with just a studio name, no routine title when entering, organisers can open or close entries by hand
- [x] 2026-11-26 – Stage 2 part 1: dancers (name, date of birth, studio), entering published events, cart with age and dancer-count checks, entries open/close on the event dates, section age and dancer limits, "ages as at" date, 3 more security tests
- [x] 2026-11-26 – Portal live at https://inspire-media-tau.vercel.app; Rick signed in as Inspire admin. Fixed: plain message when settings are missing, accept either Supabase address, no sign-in loop without a profile, explicit database access grants for newer Supabase projects
- [x] 2026-11-25 – Read the brief and requirements; agreed build order, many organisers, hosting, Square, and repository
- [x] 2026-11-25 – Stage 1: website skeleton with the Inspire logo theme, logins, Inspire admin page, organisers and staff, events, sessions and sections, program CSV import, online program editing (edit, scratch, reorder, late entries), public event page, program CSV download, sample data, and automatic security tests
