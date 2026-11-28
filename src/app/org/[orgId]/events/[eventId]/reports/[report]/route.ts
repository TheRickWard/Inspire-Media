import { NextResponse } from "next/server";
import { createSupabase } from "@/lib/supabase/server";
import { loadReportData, reportCsv, REPORTS, type ReportKey } from "@/lib/report-data";
import { reportFileName } from "@/lib/reports";

// Organiser report downloads (CSV, opens in Excel).
export async function GET(_request: Request, ctx: RouteContext<"/org/[orgId]/events/[eventId]/reports/[report]">) {
  const { orgId, eventId, report } = await ctx.params;
  if (!(report in REPORTS)) return new NextResponse("Not found.", { status: 404 });

  const supabase = await createSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new NextResponse("Please sign in.", { status: 401 });

  const { data: event } = await supabase.from("events").select("id, name").eq("id", eventId).eq("organisation_id", orgId).maybeSingle();
  const { data: canManage } = await supabase.rpc("can_manage_event", { ev: eventId });
  if (!event || !canManage) return new NextResponse("Not found.", { status: 404 });

  const csv = reportCsv(report as ReportKey, await loadReportData(supabase, eventId));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${reportFileName(event.name, report)}"`,
      "Cache-Control": "no-store",
    },
  });
}
