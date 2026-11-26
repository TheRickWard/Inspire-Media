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

/** Today's date in Sydney, as "YYYY-MM-DD". */
export function todayInSydney(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Age in whole years on a given date ("YYYY-MM-DD" strings). */
export function ageOn(dateOfBirth: string, onDate: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** "10 & under", "8–12", "13 & over" or "" from a section's age limits. */
export function describeAges(minAge: number | null, maxAge: number | null): string {
  if (minAge != null && maxAge != null) return minAge === maxAge ? `${minAge} years` : `${minAge}–${maxAge} years`;
  if (maxAge != null) return `${maxAge} & under`;
  if (minAge != null) return `${minAge} & over`;
  return "";
}
