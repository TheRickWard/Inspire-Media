// Make the local database's permissions match live Supabase, which (unlike the
// local one) doesn't give visitors and signed-in people access to tables unless
// a migration grants it. Run before `npm run test:security` to catch a page or
// query that only works locally.
//   node scripts/live-grants.mjs | docker exec -i supabase_db_inspire-media psql -U postgres -q
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../supabase/migrations/", import.meta.url);
const lines = [
  "revoke all on all tables in schema public from anon, authenticated;",
  "revoke all on all sequences in schema public from anon, authenticated;",
];
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  const sql = readFileSync(new URL(file, dir), "utf8");
  for (const m of sql.matchAll(/^\s*(grant\s+(?:select|insert|update|delete|usage|all)[^;]*;)/gims)) lines.push(m[1]);
}
console.log(lines.join("\n"));
