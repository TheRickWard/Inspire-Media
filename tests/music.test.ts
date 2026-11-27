import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { musicExtension, musicFileProblem, playlistFileName } from "../src/lib/music.ts";
import { buildZip, crc32 } from "../src/lib/zip.ts";

test("only MP3, M4A and WAV files up to 20 MB are accepted", () => {
  assert.equal(musicExtension("Routine.MP3"), "mp3");
  assert.equal(musicExtension("mix.final.m4a"), "m4a");
  assert.equal(musicExtension("track.wav"), "wav");
  assert.equal(musicExtension("mp3"), null);
  assert.equal(musicExtension("video.mp4"), null);
  assert.equal(musicFileProblem("a.mp3", 5_000_000), null);
  assert.match(musicFileProblem("a.mp3", 21 * 1024 * 1024)!, /over 20 MB/);
  assert.match(musicFileProblem("a.docx", 100)!, /MP3, M4A or WAV/);
  assert.match(musicFileProblem("a.mp3", 0)!, /empty/);
});

test("sound-desk file names sort in running order and are safe", () => {
  assert.equal(playlistFileName(3, "12A", "Jane Jones", "mp3"), "003 - Item 12A - Jane Jones.mp3");
  assert.equal(playlistFileName(12, null, "A/B: \"Crew\"", "wav"), "012 - No item number - A B Crew.wav");
});

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("the zip opens with standard tools and keeps the files in order", () => {
  const files = [
    { name: "001 - Item 1 - Jane.mp3", data: new Uint8Array([1, 2, 3, 4]) },
    { name: "002 - Item 1A - Zoë.mp3", data: new TextEncoder().encode("hello music") },
  ];
  const chunks = buildZip(files);
  const bytes = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const dir = mkdtempSync(join(tmpdir(), "zip-"));
  const path = join(dir, "music.zip");
  writeFileSync(path, bytes);
  const out = execFileSync("python3", ["-I", "-c", "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print('|'.join(n+':'+z.read(n).hex() for n in z.namelist()))", path]).toString().trim();
  assert.equal(out, "001 - Item 1 - Jane.mp3:01020304|002 - Item 1A - Zoë.mp3:" + Buffer.from("hello music").toString("hex"));
});
