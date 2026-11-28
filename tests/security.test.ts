// Checks that the database security rules keep each organiser's data private.
// Needs the local database running with sample data (npx supabase start / npx supabase db reset).
// Run with: npm run test:security
import { test } from "node:test";
import { execSync } from "node:child_process";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

const INSPIRE_ORG = "a0000000-0000-4000-8000-000000000001";
const HARBOUR_ORG = "a0000000-0000-4000-8000-000000000002";
const MAIN_EVENT = "e0000000-0000-4000-8000-000000000001"; // Inspire, published
const DRAFT_EVENT = "e0000000-0000-4000-8000-000000000002"; // Inspire, draft
const HARBOUR_EVENT = "e0000000-0000-4000-8000-000000000003"; // Harbour, draft

function anon() {
  return createClient(URL, KEY, { auth: { persistSession: false } });
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = anon();
  const { error } = await client.auth.signInWithPassword({ email, password: "Password123!" });
  assert.equal(error, null, `sign in as ${email}`);
  return client;
}

test("the public can see published events and their program, but not drafts", async () => {
  const db = anon();
  const { data: events } = await db.from("events").select("id");
  assert.deepEqual(events?.map((e) => e.id), [MAIN_EVENT]);
  const { count } = await db.from("entries").select("id", { count: "exact", head: true }).eq("event_id", MAIN_EVENT);
  assert.equal(count, 30);
  const { data: harbourEntries } = await db.from("entries").select("id").eq("event_id", HARBOUR_EVENT);
  assert.deepEqual(harbourEntries, []);
  // Visitors either get no rows or no access at all (live Supabase doesn't grant these tables to visitors).
  const { data: orgs } = await db.from("organisations").select("id");
  assert.deepEqual(orgs ?? [], []);
  const { data: profiles } = await db.from("profiles").select("id");
  assert.deepEqual(profiles ?? [], []);
});

test("the public can't change anything", async () => {
  const db = anon();
  const { data } = await db.from("events").update({ name: "Hacked" }).eq("id", MAIN_EVENT).select("id");
  assert.deepEqual(data ?? [], []);
  const { error } = await db.rpc("import_program", { ev: MAIN_EVENT, rows: [] });
  assert.ok(error, "anonymous import must be refused");
});

test("another organiser can't see or change Inspire's events", async () => {
  const db = await signIn("organiser@harbourdance.test");
  const { data: events } = await db.from("events").select("id").order("id");
  assert.deepEqual(events?.map((e) => e.id), [MAIN_EVENT, HARBOUR_EVENT], "only their own event plus published ones");

  const { data: draft } = await db.from("events").select("id").eq("id", DRAFT_EVENT);
  assert.deepEqual(draft, []);

  const { data: updated } = await db.from("events").update({ name: "Hacked" }).eq("id", MAIN_EVENT).select("id");
  assert.deepEqual(updated, []);

  const { data: scratched } = await db.from("entries").update({ status: "scratched" }).eq("event_id", MAIN_EVENT).select("id");
  assert.deepEqual(scratched, []);

  const { data: section } = await db.from("sections").select("id").eq("event_id", MAIN_EVENT).limit(1).single();
  const { error: insertError } = await db.from("entries").insert({ event_id: MAIN_EVENT, section_id: section!.id, item_number: "999", performer_name: "Intruder" });
  assert.ok(insertError, "inserting into someone else's event must be refused");

  const { error: importError } = await db.rpc("import_program", {
    ev: DRAFT_EVENT,
    rows: [{ item_number: "1", section_code: "1", performer_name: "Intruder" }],
  });
  assert.match(importError?.message ?? "", /do not have access/);

  const { error: lateError } = await db.rpc("add_late_entry", { sec: section!.id, p_item_number: "999", p_performer_name: "Intruder", p_studio_name: "", p_routine_title: "" });
  assert.ok(lateError, "late entry into someone else's event must be refused");

  const { data: orgs } = await db.from("organisations").select("id");
  assert.deepEqual(orgs?.map((o) => o.id), [HARBOUR_ORG]);

  const { error: memberError } = await db.rpc("add_organisation_member", { org: INSPIRE_ORG, member_email: "organiser@harbourdance.test", member_role: "owner" });
  assert.ok(memberError, "joining another organisation must be refused");

  const { data: theirPeople } = await db.from("profiles").select("email").order("email");
  assert.deepEqual(theirPeople?.map((p) => p.email), ["organiser@harbourdance.test"]);
});

test("Inspire staff can manage events but can't add people or make organisers", async () => {
  const db = await signIn("staff@inspire.test");
  const { data: events } = await db.from("events").select("id").eq("organisation_id", INSPIRE_ORG);
  assert.equal(events?.length, 2);
  const { data: harbour } = await db.from("events").select("id").eq("id", HARBOUR_EVENT);
  assert.deepEqual(harbour, []);

  const { error: memberError } = await db.rpc("add_organisation_member", { org: INSPIRE_ORG, member_email: "parent@example.test", member_role: "staff" });
  assert.ok(memberError, "staff can't add people");

  const { error: orgError } = await db.from("organisations").insert({ name: "Sneaky Org" });
  assert.ok(orgError, "only platform admins create organisers");
});

test("a competitor/parent account can't make itself an admin", async () => {
  const db = await signIn("parent@example.test");
  const { data: me } = await db.auth.getUser();
  const { error } = await db.from("profiles").update({ is_platform_admin: true }).eq("id", me.user!.id);
  assert.ok(error, "changing the admin flag must be refused");
  const { data: profile } = await db.from("profiles").select("is_platform_admin").eq("id", me.user!.id).single();
  assert.equal(profile?.is_platform_admin, false);

  const { error: nameError } = await db.from("profiles").update({ full_name: "Pat P." }).eq("id", me.user!.id);
  assert.equal(nameError, null, "people can change their own name");
  await db.from("profiles").update({ full_name: "Pat Parent" }).eq("id", me.user!.id);
});

test("the platform admin sees every organiser", async () => {
  const db = await signIn("admin@inspire.test");
  const { data: orgs } = await db.from("organisations").select("id");
  assert.equal(orgs?.length, 2);
  const { data: events } = await db.from("events").select("id");
  assert.equal(events?.length, 3);
});

test("program import, late entries and reordering work and are all-or-nothing", async () => {
  const db = await signIn("staff@inspire.test");
  const rows = [
    { item_number: "1", section_code: "4", section_name: "Hip Hop Solo", session: "Day 1", performer_name: "Test One" },
    { item_number: "2", section_code: "4", section_name: "Hip Hop Solo", session: "Day 1", performer_name: "Test Two" },
    { item_number: "3", section_code: "9", section_name: "Ballet Solo", session: "Day 2", performer_name: "Test Three" },
  ];
  const { data: imported, error } = await db.rpc("import_program", { ev: DRAFT_EVENT, rows });
  assert.equal(error, null);
  assert.equal(imported, 3);

  // Re-importing the same items is refused and adds nothing.
  const { error: dupeError } = await db.rpc("import_program", { ev: DRAFT_EVENT, rows: [{ item_number: "50", section_code: "4", performer_name: "New" }, ...rows] });
  assert.match(dupeError?.message ?? "", /already in the program: 1, 2, 3/);
  const { count } = await db.from("entries").select("id", { count: "exact", head: true }).eq("event_id", DRAFT_EVENT);
  assert.equal(count, 3);

  // A late entry in section 4 goes after item 2 and before item 3.
  const { data: sec4 } = await db.from("sections").select("id").eq("event_id", DRAFT_EVENT).eq("code", "4").single();
  const { error: lateError } = await db.rpc("add_late_entry", { sec: sec4!.id, p_item_number: "2A", p_performer_name: "Late Larry", p_studio_name: "", p_routine_title: "" });
  assert.equal(lateError, null);
  const order = async () => (await db.from("entries").select("item_number").eq("event_id", DRAFT_EVENT).order("position")).data?.map((e) => e.item_number);
  assert.deepEqual(await order(), ["1", "2", "2A", "3"]);

  // Move the late entry up one place.
  const { data: late } = await db.from("entries").select("id").eq("event_id", DRAFT_EVENT).eq("item_number", "2A").single();
  await db.rpc("move_entry", { entry: late!.id, direction: "up" });
  assert.deepEqual(await order(), ["1", "2A", "2", "3"]);

  // Clean up so the test can run again.
  await db.from("entries").delete().eq("event_id", DRAFT_EVENT);
  await db.from("sections").delete().eq("event_id", DRAFT_EVENT);
  await db.from("event_sessions").delete().eq("event_id", DRAFT_EVENT);
});

// ---------------------------------------------------------------- stage 2: dancers and carts

test("dancers are private to the account that added them", async () => {
  const parent = await signIn("parent@example.test");
  const { data: mine } = await parent.from("dancers").select("full_name").order("full_name");
  assert.deepEqual(mine?.map((d) => d.full_name), ["Daisy Example", "Max Example"]);

  for (const email of ["organiser@harbourdance.test", "staff@inspire.test", "admin@inspire.test"]) {
    const other = await signIn(email);
    const { data } = await other.from("dancers").select("id");
    assert.deepEqual(data, [], `${email} must not see the parent's dancers before they're entered`);
  }

  const { data: anonDancers } = await anon().from("dancers").select("id");
  assert.deepEqual(anonDancers ?? [], []);
});

test("cart: checks dancer ownership, age, number of dancers and entry dates", async () => {
  const parent = await signIn("parent@example.test");
  const { data: dancers } = await parent.from("dancers").select("id, full_name").order("full_name");
  const daisy = dancers!.find((d) => d.full_name === "Daisy Example")!.id; // 9 on 1 Jan 2027
  const max = dancers!.find((d) => d.full_name === "Max Example")!.id; // 12 on 1 Jan 2027
  const section = async (code: string) => (await parent.from("sections").select("id").eq("event_id", MAIN_EVENT).eq("code", code).single()).data!.id;

  // Age limits: section 12 is 10 & under.
  const tooOld = await parent.rpc("add_to_cart", { sec: await section("12"), p_dancer_ids: [max], p_studio_name: "" });
  assert.match(tooOld.error?.message ?? "", /Outside the age group.*Max Example \(12\)/);

  // Number of dancers: section 21 is a duo/trio.
  const soloInDuo = await parent.rpc("add_to_cart", { sec: await section("21"), p_dancer_ids: [daisy], p_studio_name: "" });
  assert.match(soloInDuo.error?.message ?? "", /at least 2 dancers/);
  const twoInSolo = await parent.rpc("add_to_cart", { sec: await section("12"), p_dancer_ids: [daisy, max], p_studio_name: "" });
  assert.match(twoInSolo.error?.message ?? "", /at most 1 dancers/);

  // Someone else's dancer.
  const organiser = await signIn("organiser@harbourdance.test");
  const stolen = await organiser.rpc("add_to_cart", { sec: await section("12"), p_dancer_ids: [daisy], p_studio_name: "" });
  assert.match(stolen.error?.message ?? "", /only enter your own dancers/);

  // A good entry goes in the cart with the section's fee.
  const ok = await parent.rpc("add_to_cart", { sec: await section("12"), p_dancer_ids: [daisy], p_studio_name: "" });
  assert.equal(ok.error, null);
  const duo = await parent.rpc("add_to_cart", { sec: await section("21"), p_dancer_ids: [daisy, max], p_studio_name: "" });
  assert.equal(duo.error, null);
  const { data: order } = await parent.from("orders").select("id, total_cents, status, order_items(id)").eq("event_id", MAIN_EVENT).eq("status", "open").single();
  assert.equal(order!.total_cents, 2500 + 3500);
  assert.equal(order!.order_items.length, 2);

  // Organisers can see carts for their own event, other organisers can't.
  const staff = await signIn("staff@inspire.test");
  const { data: staffView } = await staff.from("orders").select("id").eq("id", order!.id);
  assert.equal(staffView?.length, 1);
  const { data: otherView } = await organiser.from("orders").select("id").eq("id", order!.id);
  assert.deepEqual(otherView, []);

  // Nobody can mark an order paid directly.
  const { data: hacked } = await parent.from("orders").update({ status: "paid" }).eq("id", order!.id).select("id");
  assert.deepEqual(hacked ?? [], []);
  const { error: insertError } = await parent.from("order_items").insert({ order_id: order!.id, section_id: await section("12"), dancer_ids: [daisy], fee_cents: 0 });
  assert.ok(insertError, "cart items can only be added through add_to_cart, which sets the fee");

  // Removing items keeps the total right, and others can't remove them.
  const firstItem = order!.order_items[0].id;
  const { error: otherRemove } = await organiser.rpc("remove_from_cart", { item: firstItem });
  assert.ok(otherRemove);
  for (const i of order!.order_items) await parent.rpc("remove_from_cart", { item: i.id });
  const { data: after } = await parent.from("orders").select("total_cents").eq("id", order!.id).single();
  assert.equal(after!.total_cents, 0);

  // Entries closed: the Winter Classic has no entry dates.
  const harbour = await signIn("organiser@harbourdance.test");
  const { data: harbourSection } = await harbour.from("sections").select("id").eq("event_id", HARBOUR_EVENT).single();
  const closed = await parent.rpc("add_to_cart", { sec: harbourSection?.id ?? "00000000-0000-4000-8000-000000000000", p_dancer_ids: [daisy], p_studio_name: "" });
  assert.ok(closed.error, "can't enter a draft or closed event");

  // Studio entries: just a studio name, no dancers; not both, not neither.
  const studio = await parent.rpc("add_to_cart", { sec: await section("30"), p_dancer_ids: [], p_studio_name: "Northside Dance Co" });
  assert.equal(studio.error, null);
  const both = await parent.rpc("add_to_cart", { sec: await section("12"), p_dancer_ids: [daisy], p_studio_name: "Northside Dance Co" });
  assert.match(both.error?.message ?? "", /not both/);
  const neither = await parent.rpc("add_to_cart", { sec: await section("12"), p_dancer_ids: [], p_studio_name: "  " });
  assert.match(neither.error?.message ?? "", /at least one dancer, or enter a studio name/);
  const { data: studioItems } = await parent.from("order_items").select("id, studio_name, dancer_ids").eq("studio_name", "Northside Dance Co");
  assert.equal(studioItems?.length, 1);
  assert.deepEqual(studioItems![0].dancer_ids, []);
  await parent.rpc("remove_from_cart", { item: studioItems![0].id });

  // Organisers can close entries by hand (dates ignored), then go back to the dates.
  const { data: otherClose } = await harbour.from("events").update({ entries_override: "closed" }).eq("id", MAIN_EVENT).select("id");
  assert.deepEqual(otherClose ?? [], [], "another organiser can't close someone else's entries");
  const { error: closeError } = await staff.from("events").update({ entries_override: "closed" }).eq("id", MAIN_EVENT);
  assert.equal(closeError, null);
  const whileClosed = await parent.rpc("add_to_cart", { sec: await section("12"), p_dancer_ids: [daisy], p_studio_name: "" });
  assert.match(whileClosed.error?.message ?? "", /not open/);
  await staff.from("events").update({ entries_override: "auto" }).eq("id", MAIN_EVENT);
  const reopened = await parent.rpc("add_to_cart", { sec: await section("12"), p_dancer_ids: [daisy], p_studio_name: "" });
  assert.equal(reopened.error, null);

  // And open them by hand for an event with no entry dates (once it's published).
  const { data: harbourEvent } = await harbour.from("events").update({ entries_override: "open", status: "published" }).eq("id", HARBOUR_EVENT).select("id");
  assert.equal(harbourEvent?.length, 1);
  const manualOpen = await parent.rpc("add_to_cart", { sec: harbourSection!.id, p_dancer_ids: [daisy], p_studio_name: "" });
  assert.equal(manualOpen.error, null);
});

test("signed-out visitors can't use the cart", async () => {
  const { error } = await anon().rpc("add_to_cart", { sec: "00000000-0000-4000-8000-000000000000", p_dancer_ids: [], p_studio_name: "" });
  assert.ok(error);
});

// The local database's server key, read from `supabase status` so it isn't written in the code.
const SECRET =
  process.env.SUPABASE_SECRET_KEY ??
  (JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) as { SECRET_KEY: string }).SECRET_KEY;

test("payments: only the website's server can mark a cart paid, and paid items become entries", async () => {
  const parent = await signIn("parent@example.test");
  const server = createClient(URL, SECRET, { auth: { persistSession: false } });
  const sectionId = async (code: string) => (await parent.from("sections").select("id").eq("event_id", MAIN_EVENT).eq("code", code).single()).data!.id;

  // The cart from the previous test has Daisy's solo in section 12. Add a studio entry.
  await parent.rpc("add_to_cart", { sec: await sectionId("30"), p_dancer_ids: [], p_studio_name: "Northside Dance Co" });
  const { data: cart } = await parent.from("orders").select("id, total_cents").eq("event_id", MAIN_EVENT).eq("status", "open").single();
  assert.equal(cart!.total_cents, 2500 + 6000);

  // Signed-in people can't record a checkout or mark their own cart paid.
  const selfRecord = await parent.rpc("record_checkout", { p_order: cart!.id, p_provider: "square", p_reference: "SQ-1", p_amount_cents: 8500 });
  assert.ok(selfRecord.error);
  const selfPay = await parent.rpc("complete_order", { p_order: cart!.id, p_provider: "square", p_reference: "SQ-1", p_paid_cents: 8500, p_receipt_url: "" });
  assert.ok(selfPay.error);

  // The checkout has to be for the cart's current total.
  const wrongAmount = await server.rpc("record_checkout", { p_order: cart!.id, p_provider: "square", p_reference: "SQ-1", p_amount_cents: 100 });
  assert.match(wrongAmount.error?.message ?? "", /cart has changed/);
  assert.equal((await server.rpc("record_checkout", { p_order: cart!.id, p_provider: "square", p_reference: "SQ-1", p_amount_cents: 8500 })).error, null);

  // Changing the cart cancels that checkout.
  const { data: extra } = await parent.rpc("add_to_cart", { sec: await sectionId("15"), p_dancer_ids: [(await parent.from("dancers").select("id").eq("full_name", "Daisy Example").single()).data!.id], p_studio_name: "" });
  await parent.rpc("remove_from_cart", { item: extra as string });
  const stale = await server.rpc("complete_order", { p_order: cart!.id, p_provider: "square", p_reference: "SQ-1", p_paid_cents: 8500, p_receipt_url: "" });
  assert.match(stale.error?.message ?? "", /does not match the cart's checkout/);

  // Paying the wrong amount is refused.
  await server.rpc("record_checkout", { p_order: cart!.id, p_provider: "square", p_reference: "SQ-2", p_amount_cents: 8500 });
  const underpaid = await server.rpc("complete_order", { p_order: cart!.id, p_provider: "square", p_reference: "SQ-2", p_paid_cents: 8000, p_receipt_url: "" });
  assert.match(underpaid.error?.message ?? "", /does not match the cart total/);

  // The right payment marks it paid, once.
  const paid = await server.rpc("complete_order", { p_order: cart!.id, p_provider: "square", p_reference: "SQ-2", p_paid_cents: 8500, p_receipt_url: "https://square.test/r" });
  assert.equal(paid.error, null);
  assert.match(paid.data as string, /^INS-\d+$/);
  const again = await server.rpc("complete_order", { p_order: cart!.id, p_provider: "square", p_reference: "SQ-2", p_paid_cents: 8500, p_receipt_url: "" });
  assert.equal(again.data, paid.data, "returning to the site twice gives the same receipt");

  const { data: order } = await parent.from("orders").select("status, receipt_number, paid_amount_cents, order_items(entry_id)").eq("id", cart!.id).single();
  assert.equal(order!.status, "paid");
  assert.equal(order!.paid_amount_cents, 8500);
  assert.ok(order!.order_items.every((i) => i.entry_id));

  // The entries are in the organiser's program, without item numbers yet.
  const staff = await signIn("staff@inspire.test");
  const { data: newEntries } = await staff.from("entries").select("performer_name, studio_name, item_number, sections(code), entry_dancers(dancer_id)").eq("event_id", MAIN_EVENT).is("item_number", null).order("position");
  assert.deepEqual(
    newEntries!.map((e) => [(e.sections as unknown as { code: string }).code, e.performer_name, e.studio_name, e.entry_dancers.length]),
    [["12", "Daisy Example", "Starlight Dance Academy", 1], ["30", "Northside Dance Co", "Northside Dance Co", 0]],
  );

  // A paid cart can't be changed, and a dancer with paid entries is kept.
  const { data: daisy } = await parent.from("dancers").select("id").eq("full_name", "Daisy Example").single();
  assert.match((await parent.rpc("delete_dancer", { dancer: daisy!.id })).error?.message ?? "", /paid entries/);
  const { data: items } = await parent.from("order_items").select("id").eq("order_id", cart!.id);
  assert.ok((await parent.rpc("remove_from_cart", { item: items![0].id })).error);
});

test("numbering: new entries get letters after the item before them; renumbering starts from 1", async () => {
  const staff = await signIn("staff@inspire.test");
  const harbour = await signIn("organiser@harbourdance.test");

  // The payments test left two un-numbered entries in the main event.
  assert.ok((await harbour.rpc("number_entries", { ev: MAIN_EVENT, p_mode: "new" })).error, "other organisers can't number this program");

  const { data: added, error } = await staff.rpc("number_entries", { ev: MAIN_EVENT, p_mode: "new" });
  assert.equal(error, null);
  assert.equal(added, 2);
  const { data: lettered } = await staff.from("entries").select("item_number, performer_name").eq("event_id", MAIN_EVENT).in("performer_name", ["Daisy Example", "Northside Dance Co"]).order("position");
  assert.ok(lettered!.every((e) => /^\d+[A-Z]$/.test(e.item_number ?? "")), JSON.stringify(lettered));
  assert.equal((await staff.rpc("number_entries", { ev: MAIN_EVENT, p_mode: "new" })).data, 0, "nothing left to number");

  const { data: total } = await staff.rpc("number_entries", { ev: MAIN_EVENT, p_mode: "all" });
  const { data: all } = await staff.from("entries").select("item_number").eq("event_id", MAIN_EVENT).order("position");
  assert.equal(total, all!.length);
  assert.deepEqual(all!.map((e) => e.item_number), all!.map((_, i) => String(i + 1)));
});

test("music: competitors see and upload only their own; organisers manage their events; the bucket is private", async () => {
  const parent = await signIn("parent@example.test");
  const staff = await signIn("staff@inspire.test");
  const harbour = await signIn("organiser@harbourdance.test");
  const server = createClient(URL, SECRET, { auth: { persistSession: false } });

  // The payments test made Daisy's paid entry.
  const { data: mine } = await parent.from("entries").select("id, event_id").eq("entered_by", "44444444-4444-4444-8444-444444444444").eq("performer_name", "Daisy Example").single();
  const { data: imported } = await staff.from("entries").select("id").eq("event_id", MAIN_EVENT).is("entered_by", null).limit(1).single();

  assert.equal((await parent.rpc("music_upload_check", { entry: mine!.id })).data, null, "owner may upload");
  assert.match((await parent.rpc("music_upload_check", { entry: imported!.id })).data as string, /only upload music for your own/);
  assert.equal((await staff.rpc("music_upload_check", { entry: imported!.id })).data, null, "organiser may upload for any entry");
  assert.match((await harbour.rpc("music_upload_check", { entry: mine!.id })).data as string, /only upload music for your own/);

  // Past the due date, competitors are locked out but organisers aren't.
  await staff.from("events").update({ music_due_on: "2020-01-01" }).eq("id", MAIN_EVENT);
  assert.match((await parent.rpc("music_upload_check", { entry: mine!.id })).data as string, /closed/);
  assert.equal((await staff.rpc("music_upload_check", { entry: mine!.id })).data, null);
  await staff.from("events").update({ music_due_on: null }).eq("id", MAIN_EVENT);

  // Only the server records music; people can read their own row, organisers their event's.
  const row = { entry_id: mine!.id, event_id: MAIN_EVENT, storage_path: `${MAIN_EVENT}/${mine!.id}/x.mp3`, file_name: "song.mp3", size_bytes: 1000, content_type: "audio/mpeg" };
  assert.ok((await parent.from("entry_music").insert(row)).error, "people can't write music rows directly");
  assert.equal((await server.from("entry_music").insert(row)).error, null);
  assert.equal((await parent.from("entry_music").select("entry_id")).data?.length, 1);
  assert.equal((await staff.from("entry_music").select("entry_id").eq("event_id", MAIN_EVENT)).data?.length, 1);
  assert.deepEqual((await harbour.from("entry_music").select("entry_id")).data, []);
  assert.deepEqual((await anon().from("entry_music").select("entry_id")).data ?? [], []);

  // Nobody can read or write the bucket directly; it's private.
  assert.ok((await parent.storage.from("music").upload(`${MAIN_EVENT}/${mine!.id}/direct.mp3`, new Blob(["x"], { type: "audio/mpeg" }))).error);
  const { data: bucket } = await server.storage.getBucket("music");
  assert.equal(bucket?.public, false);
  assert.equal(bucket?.file_size_limit, 20971520);
  await server.from("entry_music").delete().eq("entry_id", mine!.id);
});

test("one cart, several competitions: one payment pays every cart, each with its own receipt", async () => {
  const parent = await signIn("parent@example.test");
  const staff = await signIn("staff@inspire.test");
  const server = createClient(URL, SECRET, { auth: { persistSession: false } });

  // A second competition taking entries.
  await staff.from("events").update({ status: "published", entries_override: "open" }).eq("id", DRAFT_EVENT);
  const { data: winterSection } = await staff.from("sections").insert({ event_id: DRAFT_EVENT, code: "W1", name: "Troupe Open", entry_fee_cents: 4000 }).select("id").single();
  const { data: mainSection } = await parent.from("sections").select("id").eq("event_id", MAIN_EVENT).eq("code", "30").single();

  await parent.rpc("add_to_cart", { sec: mainSection!.id, p_dancer_ids: [], p_studio_name: "Group Test Studio" });
  await parent.rpc("add_to_cart", { sec: winterSection!.id, p_dancer_ids: [], p_studio_name: "Group Test Studio" });
  const { data: allOpen } = await parent.from("orders").select("id, total_cents, order_items(id)").eq("status", "open").in("event_id", [MAIN_EVENT, DRAFT_EVENT]).order("created_at");
  const carts = allOpen!.filter((c) => c.order_items.length > 0);
  assert.equal(carts.length, 2, JSON.stringify(allOpen));
  const ids = carts.map((c) => c.id);
  const total = carts.reduce((s, c) => s + c.total_cents, 0);

  // Only the server can record or complete a group checkout, and only for the right total.
  assert.ok((await parent.rpc("record_checkout_group", { p_orders: ids, p_provider: "square", p_reference: "G-1", p_amount_cents: total })).error);
  assert.match((await server.rpc("record_checkout_group", { p_orders: ids, p_provider: "square", p_reference: "G-1", p_amount_cents: total - 1 })).error?.message ?? "", /cart has changed/);
  assert.equal((await server.rpc("record_checkout_group", { p_orders: ids, p_provider: "square", p_reference: "G-1", p_amount_cents: total })).error, null);

  // Changing one competition's cart cancels the checkout for both.
  const { data: extra } = await parent.rpc("add_to_cart", { sec: winterSection!.id, p_dancer_ids: [], p_studio_name: "Another Studio" });
  await parent.rpc("remove_from_cart", { item: extra as string });
  const { data: cleared } = await parent.from("orders").select("checkout_reference").in("id", ids);
  assert.deepEqual(cleared!.map((c) => c.checkout_reference), [null, null]);

  await server.rpc("record_checkout_group", { p_orders: ids, p_provider: "square", p_reference: "G-2", p_amount_cents: total });
  assert.match((await server.rpc("complete_checkout_group", { p_group: ids[0], p_provider: "square", p_reference: "G-2", p_paid_cents: total - 100, p_receipt_url: "" })).error?.message ?? "", /does not match/);
  const paid = await server.rpc("complete_checkout_group", { p_group: ids[0], p_provider: "square", p_reference: "G-2", p_paid_cents: total, p_receipt_url: "" });
  assert.equal(paid.error, null);
  const receipts = paid.data as string[];
  assert.equal(receipts.length, 2);
  assert.notEqual(receipts[0], receipts[1]);
  const again = await server.rpc("complete_checkout_group", { p_group: ids[0], p_provider: "square", p_reference: "G-2", p_paid_cents: total, p_receipt_url: "" });
  assert.deepEqual(again.data, receipts, "returning twice gives the same receipts");

  const { data: orders } = await parent.from("orders").select("status, paid_amount_cents, total_cents").in("id", ids);
  assert.ok(orders!.every((o) => o.status === "paid" && o.paid_amount_cents === o.total_cents));
  const { count } = await staff.from("entries").select("id", { count: "exact", head: true }).eq("event_id", DRAFT_EVENT).eq("performer_name", "Group Test Studio");
  assert.equal(count, 1, "the entry is in the second competition's program");

  // Each organiser only sees their own competition's cart.
  const harbour = await signIn("organiser@harbourdance.test");
  assert.deepEqual((await harbour.from("orders").select("id").in("id", ids)).data, []);

  await staff.from("events").update({ status: "draft", entries_override: "auto" }).eq("id", DRAFT_EVENT);
});

test("critiques: organisers see them; competitors only their own, once released (event or session)", async () => {
  const parent = await signIn("parent@example.test");
  const staff = await signIn("staff@inspire.test");
  const harbour = await signIn("organiser@harbourdance.test");
  const server = createClient(URL, SECRET, { auth: { persistSession: false } });

  const { data: mine } = await parent.from("entries").select("id, section_id").eq("entered_by", "44444444-4444-4444-8444-444444444444").eq("event_id", MAIN_EVENT).limit(1).single();
  const { data: other } = await staff.from("entries").select("id").eq("event_id", MAIN_EVENT).is("entered_by", null).limit(1).single();
  const row = (entry: string, n: number) => ({ entry_id: entry, event_id: MAIN_EVENT, storage_path: `${MAIN_EVENT}/${entry}/c${n}.mp3`, file_name: `c${n}.mp3`, size_bytes: 100, content_type: "audio/mpeg" });

  // People can't add critiques directly; the server can.
  assert.ok((await staff.from("entry_critiques").insert(row(mine!.id, 0))).error);
  assert.equal((await server.from("entry_critiques").insert([row(mine!.id, 1), row(other!.id, 2)])).error, null);

  // Before release: organiser sees both, the competitor sees none, other organisers none.
  assert.equal((await staff.from("entry_critiques").select("id").eq("event_id", MAIN_EVENT)).data?.length, 2);
  assert.deepEqual((await parent.from("entry_critiques").select("id")).data, []);
  assert.deepEqual((await harbour.from("entry_critiques").select("id")).data, []);

  // Only organisers can release, and the competitor then sees only their own.
  const { data: hacked } = await parent.from("events").update({ critiques_released_at: new Date().toISOString() }).eq("id", MAIN_EVENT).select("id");
  assert.deepEqual(hacked, []);
  await staff.from("events").update({ critiques_released_at: new Date().toISOString() }).eq("id", MAIN_EVENT);
  assert.deepEqual((await parent.from("entry_critiques").select("file_name")).data, [{ file_name: "c1.mp3" }]);
  await staff.from("events").update({ critiques_released_at: null }).eq("id", MAIN_EVENT);
  assert.deepEqual((await parent.from("entry_critiques").select("id")).data, []);

  // Releasing just the session that the entry is in also works.
  const { data: section } = await staff.from("sections").select("session_id").eq("id", mine!.section_id).single();
  if (section?.session_id) {
    await staff.from("event_sessions").update({ critiques_released_at: new Date().toISOString() }).eq("id", section.session_id);
    assert.equal((await parent.from("entry_critiques").select("id")).data?.length, 1);
    await staff.from("event_sessions").update({ critiques_released_at: null }).eq("id", section.session_id);
  }

  const { data: bucket } = await server.storage.getBucket("critiques");
  assert.equal(bucket?.public, false);
  await server.from("entry_critiques").delete().eq("event_id", MAIN_EVENT);
});
