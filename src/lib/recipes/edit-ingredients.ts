/**
 * Working out what changed when somebody rewrites an ingredient list.
 *
 * The list is edited as text, one ingredient per line, which is the only sane
 * way to fix a recipe on a phone. But the rows behind that text carry
 * catalog_product_id links, and those links are what tell the recipe screen
 * whether the kitchen has the ingredient. Deleting every row and re-inserting
 * the new text would be far simpler and would quietly throw all of that away —
 * a one-word typo fix would unlink the whole recipe.
 *
 * So lines that are still there keep their row, and only genuine additions and
 * removals touch the database.
 */

export type ExistingIngredient = {
  id: string;
  name: string;
};

export type IngredientPlan = {
  /** Rows that survive, with their new position. */
  keep: { id: string; name: string; sortOrder: number }[];
  /** Lines with no matching row. */
  insert: { name: string; sortOrder: number }[];
  /** Rows whose line is gone. */
  deleteIds: string[];
};

function key(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Matches by exact text after whitespace and case are normalised, and never
 * approximately. A fuzzy match here would silently move a catalogue link from
 * one ingredient to a different one, which is worse than losing it: the recipe
 * would then report having something it does not.
 *
 * A line whose text was edited is therefore a delete plus an insert, and loses
 * its link. That is the honest outcome — the text no longer says what it said,
 * so the old link is no longer known to be right.
 */
export function planIngredientEdit(
  existing: ExistingIngredient[],
  lines: string[],
): IngredientPlan {
  const available = new Map<string, string[]>();
  for (const row of existing) {
    const k = key(row.name);
    const bucket = available.get(k);
    if (bucket) bucket.push(row.id);
    else available.set(k, [row.id]);
  }

  const keep: IngredientPlan["keep"] = [];
  const insert: IngredientPlan["insert"] = [];
  const used = new Set<string>();

  let sortOrder = 0;
  const seen = new Set<string>();
  for (const raw of lines) {
    const name = raw.trim();
    if (!name) continue;
    const k = key(name);
    // A list that repeats a line is a slip, not an instruction to buy twice.
    if (seen.has(k)) continue;
    seen.add(k);

    const bucket = available.get(k);
    const id = bucket?.shift();
    if (id) {
      used.add(id);
      keep.push({ id, name, sortOrder });
    } else {
      insert.push({ name, sortOrder });
    }
    sortOrder += 1;
  }

  return {
    keep,
    insert,
    deleteIds: existing.filter((row) => !used.has(row.id)).map((row) => row.id),
  };
}
