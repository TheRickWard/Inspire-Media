// Checks that the database security rules keep each organiser's data private.
// Needs the local database running with sample data (npx supabase start / npx supabase db reset).
// Run with: npm run test:security
import { test } from "node:test";
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
  const { data: orgs } = await db.from("organisations").select("id");
  assert.deepEqual(orgs, []);
  const { data: profiles } = await db.from("profiles").select("id");
  assert.deepEqual(profiles, []);
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
  const tooOld = await parent.rpc("add_to_cart", { sec: await section("12"), p_dancer_ids: [max], p_routine_title: "" });
  assert.match(tooOld.error?.message ?? "", /Outside the age group.*Max Example \(12\)/);

  // Number of dancers: section 21 is a duo/trio.
  const soloInDuo = await parent.rpc("add_to_cart", { sec: await section("21"), p_dancer_ids: [daisy], p_routine_title: "" });
  assert.match(soloInDuo.error?.message ?? "", /at least 2 dancers/);
  const twoInSolo = await parent.rpc("add_to_cart", { sec: await section("12"), p_dancer_ids: [daisy, max], p_routine_title: "" });
  assert.match(twoInSolo.error?.message ?? "", /at most 1 dancers/);

  // Someone else's dancer.
  const organiser = await signIn("organiser@harbourdance.test");
  const stolen = await organiser.rpc("add_to_cart", { sec: await section("12"), p_dancer_ids: [daisy], p_routine_title: "" });
  assert.match(stolen.error?.message ?? "", /only enter your own dancers/);

  // A good entry goes in the cart with the section's fee.
  const ok = await parent.rpc("add_to_cart", { sec: await section("12"), p_dancer_ids: [daisy], p_routine_title: "Shine" });
  assert.equal(ok.error, null);
  const duo = await parent.rpc("add_to_cart", { sec: await section("21"), p_dancer_ids: [daisy, max], p_routine_title: "Tap Happy" });
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
  const closed = await parent.rpc("add_to_cart", { sec: harbourSection?.id ?? "00000000-0000-4000-8000-000000000000", p_dancer_ids: [daisy], p_routine_title: "" });
  assert.ok(closed.error, "can't enter a draft or closed event");
});

test("signed-out visitors can't use the cart", async () => {
  const { error } = await anon().rpc("add_to_cart", { sec: "00000000-0000-4000-8000-000000000000", p_dancer_ids: [], p_routine_title: "" });
  assert.ok(error);
});
