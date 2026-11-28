// Music file rules shared by the website and the browser.

export const MAX_MUSIC_BYTES = 20 * 1024 * 1024;

const TYPES: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav" };

/** "Song.MP3" -> "mp3", or null if it isn't a music file we accept. */
export function musicExtension(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext in TYPES && fileName.includes(".") ? ext : null;
}

export function musicContentType(ext: string): string {
  return TYPES[ext] ?? "application/octet-stream";
}

/** Why this file can't be uploaded, or null if it's fine. */
export function musicFileProblem(fileName: string, sizeBytes: number): string | null {
  if (!musicExtension(fileName)) return "Please choose an MP3, M4A or WAV file.";
  if (sizeBytes <= 0) return "That file is empty.";
  if (sizeBytes > MAX_MUSIC_BYTES) return "That file is over 20 MB. Please choose a smaller file (an MP3 is usually 3–8 MB).";
  return null;
}

export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * File name inside the sound-desk download. The running-order number goes first
 * so the files sort like the program (in a folder and in Inspire MediaPlay),
 * then competitor, section and music title (left out when there isn't one):
 * "003 - Jane Jones - Junior Jazz Solo - Shake It Off.mp3".
 */
export function playlistFileName(order: number, performer: string, section: string, musicTitle: string | null, ext: string): string {
  // " - " separates the parts, so a dash inside a name becomes "–".
  const clean = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+-\s+/g, " – ").replace(/\s+/g, " ").trim();
  const parts = [clean(performer).slice(0, 80) || "Performer", clean(section).slice(0, 60), clean(musicTitle ?? "").slice(0, 60)].filter(Boolean);
  return `${String(order).padStart(3, "0")} - ${parts.join(" - ")}.${ext}`;
}
