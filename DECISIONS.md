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

## 2026-11-27 – One cart for several competitions
**Decision:** Competitors have one Cart page (link at the top of every page) holding entries for all their competitions, paid in a single Square or PayPal payment. Behind the scenes each competition keeps its own cart, so each organiser only sees their own entries and each competition gets its own receipt number (the receipt shows which other receipts the same payment covered). Changing any part of the cart cancels a payment that was started, so the amount always matches. If one competition has closed, its items must be removed before paying.
**Why:** Rick's requirements ask for a shopping cart for multiple events (confirmed 27 Nov).
**Note:** All payments still go to Inspire's Square/PayPal accounts (see "How online payments work").

## 2026-11-28 – Voice critiques (portal)
**Decision:** Organisers upload adjudicators' recorded critiques on a new Critiques tab (MP3, M4A, WAV or WebM, up to 20 MB, private storage). Many files can be uploaded at once: each is matched to an entry by the item number in its file name ("12A.mp3", "012 - Jane.m4a", "Item 12A.wav"), and the matches are shown before anything uploads. An entry can have several critiques (one per adjudicator); a single one can be added or removed on any entry. Competitors only see, play and download their own critiques after the organiser presses Release (for the whole competition, or one session at a time); releasing can be undone with "Hide".
**Why:** Rick asked (28 Nov) for the critiques portal with a release button, amendments later if needed.

## 2026-11-28 – Reports and printable program
**Decision:** Each competition has a Reports tab with a summary (entries, studios, money received online, music and critiques still missing; tables by section and by studio) and three spreadsheet downloads (CSV): entries (with who entered, receipt, fee, music and critique), studio totals, and payments. Dates of birth are never included. The printable program lists the running order by session then section (item, performer, studio), leaves out scratched entries, and is printed or saved as PDF with the browser's own print window (no new library). Anyone can see it once the competition is published; organisers can print a draft.
**Why:** Rick chose reports and a printable program next (28 Nov) to finish the portal before the venue tools.

## 2026-11-28 – Refunds
**Decision:** Refunds are given from the receipt page, by the organisation's owners and the site admin only (not staff), because they move money. Tick the entries being refunded (the amount fills in from their fees and can be lowered, e.g. to keep an admin fee), or tick none for a part refund. The money goes back through the same Square or PayPal payment, or the refund is just recorded if it was paid back another way (cash, bank transfer). Ticked entries can be scratched from the program at the same time. The database never allows more than was paid to be refunded, or the same entry twice. If Square/PayPal can't be reached, the refund waits and can be tried again without any risk of refunding twice. Square/PayPal tell the payer; the portal doesn't send its own email. Receipts show refunds and the total after refunds; the Payments tab and Reports show money received after refunds.
**Why:** Rick asked for refunds in the portal (28 Nov).

## 2026-11-28 – Sound Desk music player: an installable offline web app
**Decision:** The sound-desk player is a web app at /player on the portal's address, installed as an app (Edge/Chrome "Install app" on Windows, "Add to Home Screen" on iPad) rather than separate native Windows and iPad apps. Music is loaded from the portal's "Download all music" zip (or music files from a folder or USB stick) and kept on the device, so it plays with no internet. While a song is playing or paused, every other Play button is locked until Stop or the song ends. Late music is placed by the item number at the start of its file name ("12B ...") and can be moved with up/down buttons. Volume is set in the app (through the browser's audio engine, because iPads ignore a web player's own volume). The player is plain files in public/player (no new libraries, no build step), and it doesn't need anyone to sign in.
**Why:** Rick chose this (28 Nov): one app covers Windows and iPad, no App Store, Apple developer fee or Mac needed, updates arrive automatically, and the critique recorder can be built the same way.
**Limits:** On iPad the sound output is chosen in Control Centre, not in the app. iPad can clear stored website data if it runs very low on space, so load the music on the morning of the event. On iPad, load the music inside the installed app (it keeps its own storage, separate from Safari). Zips over 4 GB can't be read; download one session at a time instead.

## 2026-11-28 – Music download file names
**Decision:** Files in "Download all music" are named competitor, section, then music title if there is one, with the running-order number first: "003 - Jane Jones - Junior Jazz Solo - Shake It Off.mp3". The item number is no longer in the name. The music title is the entry's "routine title" (filled in from an imported program CSV; online entries don't ask for one). A " - " inside a name becomes "–" so the parts stay clear. The Sound Desk player reads both the new names and the older "003 - Item 12A - ..." names.
**Why:** Rick asked for competitor, section, music title (28 Nov). The running-order number stays at the front so the files sort like the program in a folder and in the player.
**Note:** Without item numbers in the zip, late music added in the player goes to the end of the list and is moved into place with ▲ ▼.

## 2026-11-28 – Sound Desk: play straight from USB or a folder
**Decision:** The player has a "USB / folder" panel on the left. "Choose folder" (Windows) or "Choose files" (iPad and Windows) lists the music there, in name order, with a Play button on each. These songs play straight from the USB stick or folder: they aren't copied to the device, aren't added to the running-order list, don't get marked played and don't change "Up next". The same one-song-at-a-time lock covers the panel and the list. The panel empties when the player is closed (browsers only allow access to the files you chose this time).
A USB song shows in its own small player (progress, Pause, Stop, Back to start) inside the panel; the big controls stay for the list, which keeps priority on the page.
**Why:** Rick asked (28 Nov) to play music from a USB drive or onboard folder without importing it into the list.

## 2026-11-28 – Sound Desk: fade out, search, song lengths, played in blue
**Decision:** "Fade out" lowers the music to silence over 3 seconds, then stops (Stop or Pause during a fade cancel it and bring the volume back). A search box filters the list by competitor, section, music title or item number. Each song's length is read on the device in the background and shown in the list (and the USB panel). There is one "Time limit" setting in the player (e.g. 3:00, blank = off); songs longer than it show ⚠ in red. Played songs are highlighted in Inspire blue (#0096d6).
**Why:** Rick picked suggestions 1–3 (28 Nov) and asked for played songs in blue from his colour theme. The portal doesn't store per-section time limits yet, so the player has one limit for now.
