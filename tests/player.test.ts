import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatTime, isAudioFile, latePosition, parseLimit, parseTrackName, readZip, sortImported } from "../public/player/core.mjs";
import { buildZip } from "../src/lib/zip.ts";
import { playlistFileName } from "../src/lib/music.ts";

type Track = { fileName: string; order: number | null; item: string | null; performer: string; detail: string };
const track = (fileName: string): Track => ({ fileName, ...parseTrackName(fileName) });

test("reads the portal's music file names", () => {
  assert.deepEqual(parseTrackName("003 - Jane Jones - Junior Jazz Solo - Shake It Off.mp3"), { order: 3, item: null, performer: "Jane Jones", detail: "Junior Jazz Solo - Shake It Off" });
  assert.deepEqual(parseTrackName("Event/010 - Starlight Studio - Troupe Open.m4a"), { order: 10, item: null, performer: "Starlight Studio", detail: "Troupe Open" });
  // Names made by the portal always parse back to the same details.
  assert.deepEqual(parseTrackName(playlistFileName(42, "Mia - Co", "Duo 10 & Under", null, "mp3")), { order: 42, item: null, performer: "Mia – Co", detail: "Duo 10 & Under" });
  // Zips from before 28 Nov still load.
  assert.deepEqual(parseTrackName("003 - Item 12A - Jane Jones.mp3"), { order: 3, item: "12A", performer: "Jane Jones", detail: "" });
  assert.deepEqual(parseTrackName("010 - No item number - Starlight Studio.m4a"), { order: 10, item: null, performer: "Starlight Studio", detail: "" });
});

test("late music from a USB stick: item number picked up when the name starts with one", () => {
  assert.deepEqual(parseTrackName("12b Jane late.mp3"), { order: null, item: "12B", performer: "Jane late", detail: "" });
  assert.deepEqual(parseTrackName("Item 7 - Sam.mp3"), { order: null, item: "7", performer: "Sam", detail: "" });
  assert.deepEqual(parseTrackName("12 - Sam.mp3"), { order: null, item: "12", performer: "Sam", detail: "" });
  assert.deepEqual(parseTrackName("Jane final mix.mp3"), { order: null, item: null, performer: "Jane final mix", detail: "" });
});

test("only music files are imported", () => {
  assert.equal(isAudioFile("001 - Item 1 - A.MP3"), true);
  assert.equal(isAudioFile("x.m4a"), true);
  assert.equal(isAudioFile("x.wav"), true);
  assert.equal(isAudioFile("x.aac"), true);
  assert.equal(isAudioFile("program.pdf"), false);
  assert.equal(isAudioFile("__MACOSX/._001.mp3"), false);
  assert.equal(isAudioFile(".DS_Store"), false);
});

test("imports sort into running order by the portal's order number", () => {
  const sorted = sortImported([track("010 - Item 9 - C.mp3"), track("002 - Item 1A - B.mp3"), track("001 - Item 1 - A.mp3")]);
  assert.deepEqual(sorted.map((t: Track) => t.performer), ["A", "B", "C"]);
  const loose = sortImported([track("10 C.mp3"), track("2 B.mp3"), track("1A Z.mp3"), track("1 A.mp3")]);
  assert.deepEqual(loose.map((t: Track) => t.item), ["1", "1A", "2", "10"]);
});

test("late tracks slot in after the item number before them", () => {
  const list = [track("001 - Item 11 - A.mp3"), track("002 - Item 12 - B.mp3"), track("003 - Item 12A - C.mp3"), track("004 - Item 13 - D.mp3")];
  assert.equal(latePosition(list, track("12B Late.mp3")), 3);
  assert.equal(latePosition(list, track("13A Late.mp3")), 4);
  assert.equal(latePosition(list, track("5 Early.mp3")), 0);
  assert.equal(latePosition(list, track("No number.mp3")), 4);
});

test("times show as minutes and seconds", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(65.9), "1:05");
  assert.equal(formatTime(NaN), "–:––");
});

test("reads the portal's own music zip", async () => {
  const chunks = buildZip([
    { name: "001 - Item 1 - Jane.mp3", data: new Uint8Array([1, 2, 3, 4]) },
    { name: "notes.txt", data: new Uint8Array([9]) },
    { name: "002 - Item 1A - Zoë.mp3", data: new TextEncoder().encode("hello music") },
  ]);
  const files = await readZip(new Blob(chunks as BlobPart[]));
  assert.deepEqual(files.map((f) => f.name), ["001 - Item 1 - Jane.mp3", "002 - Item 1A - Zoë.mp3"]);
  assert.deepEqual([...new Uint8Array(await files[0].blob.arrayBuffer())], [1, 2, 3, 4]);
  assert.equal(await files[1].blob.text(), "hello music");
});

test("reads a compressed zip made by another program (folders included)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "player-"));
  const music = "la ".repeat(5000);
  execFileSync("python3", ["-I", "-c", [
    "import sys, zipfile",
    "z = zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED)",
    "z.writestr('Saturday/', '')",
    "z.writestr('Saturday/003 - Item 2 - Sam.mp3', sys.argv[2])",
    "z.writestr('__MACOSX/Saturday/._003 - Item 2 - Sam.mp3', 'junk')",
    "z.close()",
  ].join("\n"), join(dir, "c.zip"), music]);
  const files = await readZip(new Blob([readFileSync(join(dir, "c.zip"))]));
  assert.equal(files.length, 1);
  assert.equal(files[0].name, "003 - Item 2 - Sam.mp3");
  assert.equal(await files[0].blob.text(), music);
});

test("a file that isn't a zip gives a plain message", async () => {
  const dir = mkdtempSync(join(tmpdir(), "player-"));
  writeFileSync(join(dir, "x.zip"), "not a zip at all, just text");
  await assert.rejects(readZip(new Blob([readFileSync(join(dir, "x.zip"))])), /doesn't look like a zip/);
});

test("time limits can be typed several ways", () => {
  assert.equal(parseLimit("3:00"), 180);
  assert.equal(parseLimit("2.30"), 150);
  assert.equal(parseLimit("4"), 240);
  assert.equal(parseLimit("150"), 150);
  assert.equal(parseLimit(""), null);
  assert.equal(parseLimit("three"), undefined);
});
