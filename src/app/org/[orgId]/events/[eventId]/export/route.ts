import { NextResponse } from "next/server";
import { createSupabase } from "@/lib/supabase/server";
import { programToCsv } from "@/lib/program-csv";

// Program download for the venue tools: every item in running order.
export async function GET(_request: Request, ctx: RouteContext<"/org/[orgId]/events/[eventId]/export">) {
  const { orgId, eventId } = await ctx.params;
  const supabase = await createSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new NextResponse("Please sign in.", { status: 401 });

  const { data: event } = await supabase.from("events").select("id, name").eq("id", eventId).eq("organisation_id", orgId).maybeSingle();
  const { data: canManage } = await supabase.rpc("can_manage_event", { ev: eventId });
  if (!event || !canManage) return new NextResponse("Not found.", { status: 404 });

  const { data: entries, error } = await supabase
    .from("entries")
    .select("position, item_number, performer_name, studio_name, routine_title, status, is_late_entry, sections(code, name, genre, age_group, event_sessions(name))")
    .eq("event_id", eventId)
    .order("position");
  if (error) return new NextResponse(error.message, { status: 500 });

  const csv = programToCsv(
    (entries ?? []).map((e, i) => ({
      position: i + 1,
      item_number: e.item_number,
      section_code: e.sections?.code ?? "",
      section_name: e.sections?.name ?? "",
      session: e.sections?.event_sessions?.name ?? "",
      performer_name: e.performer_name,
      studio_name: e.studio_name,
      routine_title: e.routine_title,
      genre: e.sections?.genre ?? "",
      age_group: e.sections?.age_group ?? "",
      status: e.status,
      is_late_entry: e.is_late_entry,
    })),
  );

  const filename = `${event.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-program.csv`;
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
