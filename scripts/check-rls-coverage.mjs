/**
 * Fails when the app performs a database verb that no migration grants a
 * policy for.
 *
 * Every one of the four silent-write bugs found in this app so far was the
 * same shape: the screen worked, the action returned ok, and the row never
 * moved, because RLS had no policy for that verb and an update matching zero
 * rows is not an error. They were each found by accident, months apart, by
 * noticing a screen that was emptier than it should be.
 *
 * This finds them at build time instead. It reads the (table, verb) pairs out
 * of the source and the policies out of the migrations, and reports any verb
 * the app uses that nothing grants.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !name.includes(".test.")) out.push(p);
  }
  return out;
}

const VERB = { insert: "INSERT", upsert: "INSERT", update: "UPDATE", delete: "DELETE", select: "SELECT" };

const used = new Map();
for (const file of walk("src")) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/\.from\("([a-z_]+)"\)/g)) {
    const table = m[1];
    const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 400);
    const verb = tail.match(/\.(insert|upsert|update|delete|select)\(/);
    if (!verb) continue;
    if (!used.has(table)) used.set(table, new Set());
    used.get(table).add(VERB[verb[1]]);
  }
}

const granted = new Map();
for (const name of readdirSync("supabase/migrations").sort()) {
  const sql = readFileSync(join("supabase/migrations", name), "utf8");
  for (const m of sql.matchAll(
    /create\s+policy\s+"[^"]+"\s*(?:\n\s*)?on\s+(?:public\.)?(\w+)\s*(?:\n\s*)?for\s+(select|insert|update|delete|all)/gi,
  )) {
    const table = m[1];
    const verb = m[2].toUpperCase();
    if (!granted.has(table)) granted.set(table, new Set());
    if (verb === "ALL") for (const v of ["SELECT", "INSERT", "UPDATE", "DELETE"]) granted.get(table).add(v);
    else granted.get(table).add(verb);
  }
}

const problems = [];
for (const [table, verbs] of [...used].sort()) {
  const allowed = granted.get(table);
  // A table with no policy in any migration predates them or is seeded
  // elsewhere; this check is about verbs missing from a table it does know.
  if (!allowed) continue;
  for (const verb of verbs) {
    if (!allowed.has(verb)) problems.push(`${table}: app performs ${verb}, no migration grants it`);
  }
}

if (problems.length > 0) {
  console.error("RLS coverage gaps — these writes would fail silently:\n");
  for (const p of problems) console.error(`  ${p}`);
  console.error("");
  process.exit(1);
}
console.log(`RLS coverage OK — ${used.size} tables used, ${granted.size} covered by migrations.`);
