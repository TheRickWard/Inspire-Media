// Critique file rules and matching recordings to entries (shared by the website and the browser).

export const MAX_CRITIQUE_BYTES = 20 * 1024 * 1024;

const TYPES: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", webm: "audio/webm" };

export function critiqueExtension(fileName: string): string | null {
  if (!fileName.includes(".")) return null;
  const ext = fileName.split(".").pop()!.toLowerCase();
  return ext in TYPES ? ext : null;
}

export function critiqueContentType(ext: string): string {
  return TYPES[ext] ?? "application/octet-stream";
}

export function critiqueFileProblem(fileName: string, sizeBytes: number): string | null {
  if (!critiqueExtension(fileName)) return "Please choose an MP3, M4A, WAV or WebM recording.";
  if (sizeBytes <= 0) return "That file is empty.";
  if (sizeBytes > MAX_CRITIQUE_BYTES) return "That recording is over 20 MB.";
  return null;
}

/** "012a" -> "12A", so "12A", "012A" and "12a" all match. */
export function normaliseItemNumber(value: string): string {
  return value.trim().toUpperCase().replace(/^0+(?=\d)/, "");
}

/**
 * The item number a recording belongs to, from its file name:
 * "12A.mp3", "012A - Jane Jones.m4a", "Item 12A - Jane.wav", "Critique_item12a.webm".
 */
export function itemNumberFromFileName(fileName: string): string | null {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "");
  const labelled = /item[\s_-]*0*(\d+[a-z]?)(?![a-z0-9])/i.exec(base);
  if (labelled) return normaliseItemNumber(labelled[1]);
  const leading = /^\s*0*(\d+[a-z]?)(?![a-z0-9])/i.exec(base);
  return leading ? normaliseItemNumber(leading[1]) : null;
}

/** Name a downloaded critique so it makes sense on its own: "Item 12 - Jane Jones - Jazz Solo 10 & Under - Ms Smith.mp3". */
export function critiqueDownloadName(
  itemNumber: string | null,
  performer: string,
  section: string | null,
  adjudicator: string | null,
  ext: string,
): string {
  // "&" and "%" are swapped out because storage download links mangle them.
  const clean = (s: string) =>
    s.replace(/&/g, " and ").replace(/%/g, " percent ").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  const parts = [
    itemNumber ? `Item ${clean(itemNumber)}` : "",
    clean(performer).slice(0, 80) || "Performer",
    clean(section ?? "").slice(0, 80),
    clean(adjudicator ?? "").slice(0, 40),
  ].filter(Boolean);
  return `${parts.join(" - ")}.${ext}`;
}
