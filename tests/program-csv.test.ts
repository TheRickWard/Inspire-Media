// Checks the program CSV reader. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseProgramCsv } from "../src/lib/program-csv.ts";

test("reads the sample program file", () => {
  const result = parseProgramCsv(readFileSync("public/samples/sample-program.csv", "utf8"));
  assert.deepEqual(result.missingColumns, []);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 30);
  assert.equal(new Set(result.rows.map((r) => r.section_code)).size, 4);
  assert.equal(result.rows[0].item_number, "1");
});

test("accepts different column names and an Excel byte-order mark", () => {
  const csv = "﻿Item No,Section No,Competitor,Dance School\n45A,12,Ava Smith,Starlight\n";
  const result = parseProgramCsv(csv);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows[0], {
    item_number: "45A",
    section_code: "12",
    section_name: "",
    session: "",
    performer_name: "Ava Smith",
    studio_name: "Starlight",
    routine_title: "",
    genre: "",
    age_group: "",
  });
});

test("reports missing required columns", () => {
  const result = parseProgramCsv("Item,Performer\n1,Ava\n");
  assert.deepEqual(result.missingColumns, ["Section"]);
});

test("reports blank names and duplicate item numbers with their row", () => {
  const csv = "Item,Section,Performer\n1,12,Ava\n2,12,\n1,12,Mia\n";
  const result = parseProgramCsv(csv);
  assert.equal(result.rows.length, 1);
  assert.deepEqual(result.errors, [
    { line: 3, message: "Performer name is missing" },
    { line: 4, message: "Item 1 is also on row 2" },
  ]);
});
