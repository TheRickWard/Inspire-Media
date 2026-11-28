import Link from "next/link";
import { link, muted } from "@/components/ui";

const tabs = [
  { key: "details", label: "Details", path: "" },
  { key: "program", label: "Program", path: "/program" },
  { key: "sections", label: "Sections & sessions", path: "/sections" },
  { key: "payments", label: "Payments", path: "/payments" },
  { key: "music", label: "Music", path: "/music" },
  { key: "critiques", label: "Critiques", path: "/critiques" },
  { key: "reports", label: "Reports", path: "/reports" },
  { key: "import", label: "Import CSV", path: "/import" },
] as const;

export function EventNav({
  orgId,
  orgName,
  event,
  current,
}: {
  orgId: string;
  orgName: string;
  event: { id: string; name: string; status: string };
  current: (typeof tabs)[number]["key"];
}) {
  const base = `/org/${orgId}/events/${event.id}`;
  return (
    <div className="space-y-3">
      <p className={muted}>
        <Link href={`/org/${orgId}`} className={link}>{orgName}</Link> /
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-brand-ink">{event.name}</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${event.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
          {event.status === "published" ? "Published" : "Draft"}
        </span>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`${base}${t.path}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              current === t.key ? "border-brand-magenta text-brand-ink" : "border-transparent text-slate-500 hover:text-brand-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
