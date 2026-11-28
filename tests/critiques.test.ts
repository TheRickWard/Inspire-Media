import { test } from "node:test";
import assert from "node:assert/strict";
import { critiqueFileProblem, itemNumberFromFileName, normaliseItemNumber } from "../src/lib/critiques.ts";

test("recordings are matched to item numbers from their file names", () => {
  assert.equal(itemNumberFromFileName("12A.mp3"), "12A");
  assert.equal(itemNumberFromFileName("012a - Jane Jones.m4a"), "12A");
  assert.equal(itemNumberFromFileName("7.wav"), "7");
  assert.equal(itemNumberFromFileName("045 Lucy.webm"), "45");
  assert.equal(itemNumberFromFileName("Item 12B - Troupe.mp3"), "12B");
  assert.equal(itemNumberFromFileName("Critique_item003.mp3"), "3");
  assert.equal(itemNumberFromFileName("Day1/Session2/30.mp3"), "30");
  assert.equal(itemNumberFromFileName("Jane Jones.mp3"), null);
  assert.equal(itemNumberFromFileName("12AB.mp3"), null, "two letters isn't an item number");
});

test("item numbers compare without leading zeros or case", () => {
  assert.equal(normaliseItemNumber(" 007b "), "7B");
  assert.equal(normaliseItemNumber("0"), "0");
});

test("only audio recordings up to 20 MB are accepted", () => {
  assert.equal(critiqueFileProblem("a.webm", 1000), null);
  assert.equal(critiqueFileProblem("a.M4A", 1000), null);
  assert.match(critiqueFileProblem("a.pdf", 1000)!, /MP3, M4A, WAV or WebM/);
  assert.match(critiqueFileProblem("a.mp3", 21 * 1024 * 1024)!, /over 20 MB/);
});
