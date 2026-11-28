// Sound-desk player: the parts that don't touch the screen (reading zips,
// understanding file names, keeping the running order). Plain JavaScript so it
// runs offline straight from /player/ with no build step, and is tested in
// tests/player.test.ts.

export const AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "aac"];

/** True for music files the player can import (by file name). */
export function isAudioFile(name) {
  const base = name.split("/").pop() ?? "";
  if (base.startsWith(".") || name.includes("__MACOSX/")) return false;
  const m = /\.([a-z0-9]+)$/i.exec(base);
  return !!m && AUDIO_EXTENSIONS.includes(m[1].toLowerCase());
}

/**
 * Understand a file name from the portal's "Download all music" zip:
 * "003 - Jane Jones - Junior Jazz Solo - Shake It Off.mp3"
 *   -> { order: 3, item: null, performer: "Jane Jones", detail: "Junior Jazz Solo - Shake It Off" }.
 * Older portal zips ("003 - Item 12A - Jane Jones.mp3") still work.
 * Other names (e.g. late music from a USB stick) still work too: the item number
 * is picked up if the name starts with one ("12B Jane.mp3", "Item 12B - Jane.mp3").
 */
export function parseTrackName(fileName) {
  const base = (fileName.split("/").pop() ?? fileName).replace(/\.[a-z0-9]+$/i, "").trim();
  const older = /^(\d{1,4})\s*-\s*(?:Item\s+(.+?)|No item number)\s*-\s*(.+)$/i.exec(base);
  if (older) {
    return { order: Number(older[1]), item: older[2]?.trim() || null, performer: older[3].trim(), detail: "" };
  }
  const portal = /^(\d{3,4}) - (.+)$/.exec(base);
  if (portal) {
    const [performer, ...rest] = portal[2].split(" - ");
    return { order: Number(portal[1]), item: null, performer: performer.trim(), detail: rest.join(" - ").trim() };
  }
  const loose = /^(?:Item\s*)?(\d{1,4}[A-Z]?)\b\s*[-–_.]?\s*(.*)$/i.exec(base);
  if (loose) {
    return { order: null, item: loose[1].toUpperCase(), performer: loose[2].trim() || base, detail: "" };
  }
  return { order: null, item: null, performer: base, detail: "" };
}

/** Split an item number like "12A" into [12, "A"] for sorting. */
function itemKey(item) {
  const m = /^(\d+)([A-Z]*)$/i.exec(item ?? "");
  return m ? [Number(m[1]), m[2].toUpperCase()] : null;
}

function compareItems(a, b) {
  const ka = itemKey(a), kb = itemKey(b);
  if (!ka || !kb) return 0;
  return ka[0] - kb[0] || (ka[1] < kb[1] ? -1 : ka[1] > kb[1] ? 1 : 0);
}

/** Sort tracks from one import into running order (portal order number, then item number, then name). */
export function sortImported(tracks) {
  return [...tracks].sort((a, b) => {
    if (a.order != null && b.order != null && a.order !== b.order) return a.order - b.order;
    if (a.order != null && b.order == null) return -1;
    if (a.order == null && b.order != null) return 1;
    const byItem = a.item && b.item ? compareItems(a.item, b.item) : 0;
    return byItem || a.fileName.localeCompare(b.fileName, undefined, { numeric: true });
  });
}

/**
 * Where a late track goes in the list: straight after the last track whose item
 * number comes before it (so "12B" lands after "12A"). With no usable item
 * number it goes at the end. Returns an index to insert at.
 */
export function latePosition(list, track) {
  if (!itemKey(track.item)) return list.length;
  let at = -1;
  list.forEach((t, i) => {
    if (itemKey(t.item) && compareItems(t.item, track.item) <= 0) at = i;
  });
  if (at === -1) {
    // Comes before every numbered track: put it before the first numbered one.
    const first = list.findIndex((t) => itemKey(t.item));
    return first === -1 ? list.length : first;
  }
  return at + 1;
}

/** "1:05" from seconds. */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "–:––";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Read the music files out of a zip without loading the whole zip into memory
 * (an event's zip can be well over 1 GB, which an iPad can't hold at once).
 * Handles the portal's own zips (not compressed) and zips made by Windows or a
 * Mac (compressed), using the browser's built-in decompression.
 * Returns [{ name, blob }] for music files only.
 */
export async function readZip(file) {
  const size = file.size;
  if (size < 22) throw new Error("This doesn't look like a zip file.");
  const tailStart = Math.max(0, size - 65_557);
  const tail = new DataView(await file.slice(tailStart, size).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("This doesn't look like a zip file, or it didn't finish downloading.");
  const count = tail.getUint16(eocd + 10, true);
  const cdSize = tail.getUint32(eocd + 12, true);
  const cdOffset = tail.getUint32(eocd + 16, true);
  if (count === 0xffff || cdOffset === 0xffffffff) {
    throw new Error("This zip is too big to read (over 4 GB). Download the music one session at a time instead.");
  }
  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const utf8 = new TextDecoder("utf-8");
  const out = [];
  let p = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > cd.byteLength || cd.getUint32(p, true) !== 0x02014b50) {
      throw new Error("This zip file is damaged. Try downloading it again.");
    }
    const method = cd.getUint16(p + 10, true);
    const compSize = cd.getUint32(p + 20, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    const localOffset = cd.getUint32(p + 42, true);
    const name = utf8.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/") || !isAudioFile(name)) continue;

    const local = new DataView(await file.slice(localOffset, localOffset + 30).arrayBuffer());
    if (local.getUint32(0, true) !== 0x04034b50) throw new Error("This zip file is damaged. Try downloading it again.");
    const dataStart = localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
    const raw = file.slice(dataStart, dataStart + compSize);
    let blob;
    if (method === 0) {
      blob = raw;
    } else if (method === 8 && typeof DecompressionStream !== "undefined") {
      blob = await new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
    } else {
      throw new Error(`Can't unpack "${name.split("/").pop()}" from this zip. Unzip it first, then choose the music files instead.`);
    }
    out.push({ name: name.split("/").pop() ?? name, blob });
  }
  return out;
}
