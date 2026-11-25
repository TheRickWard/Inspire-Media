const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "2027-03-14" -> "14 Mar 2027" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  return dateFmt.format(new Date(`${value}T00:00:00Z`));
}

export function formatDateRange(start: string, end: string): string {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}
