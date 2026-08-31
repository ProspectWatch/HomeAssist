/**
 * Screening a planned meal against what the people eating it can't have.
 *
 * WHAT THIS IS: a text match between the allergens a household has recorded
 * and the names of a recipe's ingredients. It catches "Peanut" in "Peanut
 * Butter" and "Milk" in "2% Milk", which is most of what a family plan needs.
 *
 * WHAT THIS IS NOT: an allergy check. It reads ingredient names and nothing
 * else. It cannot see inside a packaged product, does not know that Worcester
 * sauce contains fish or that a stock cube contains milk, and has never seen
 * the label. A clear result means "nothing in the names matched", never "this
 * is safe to eat", and every screen returns `checked: false` about the parts it
 * could not read so the UI can say so rather than implying an all-clear.
 *
 * The asymmetry is deliberate everywhere below: a false alarm makes someone
 * check a label they were going to check anyway; a missed allergen is the kind
 * of failure this feature would exist to prevent. So matching is broad, and
 * anything uncertain is reported rather than dropped.
 */

export type AllergenHit = {
  personId: string;
  personName: string;
  /** The recorded allergen that matched, as the household typed it. */
  allergen: string;
  /** The ingredient whose name it matched. */
  ingredient: string;
};

export type DislikeHit = {
  personId: string;
  personName: string;
  dislike: string;
  ingredient: string;
};

export type MealScreen = {
  allergens: AllergenHit[];
  dislikes: DislikeHit[];
  /**
   * False when at least one ingredient could not be read as text — an empty
   * name, or a recipe with no ingredients recorded at all. The absence of hits
   * says nothing in that case, and the UI must not present it as an all-clear.
   */
  checked: boolean;
};

export type ScreenablePerson = {
  id: string;
  name: string;
  allergies: string[];
  dislikes: string[];
};

/** Lowercase, strip punctuation, collapse whitespace. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Does `term` appear as a whole word inside `text`?
 *
 * Whole-word rather than substring, because substring matching turns "egg"
 * into a hit on "eggplant" and trains people to ignore the warnings — which is
 * the one outcome worse than not having them. A trailing "s" is allowed on
 * either side so "Egg" matches "Eggs" and "Nuts" matches "Nut".
 */
export function mentions(text: string, term: string): boolean {
  const haystack = normalise(text);
  const needle = normalise(term);
  if (!haystack || !needle) return false;

  const words = haystack.split(" ");
  const stem = (w: string) => (w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w);
  const needleWords = needle.split(" ").map(stem);

  for (let i = 0; i + needleWords.length <= words.length; i++) {
    if (needleWords.every((n, j) => stem(words[i + j]) === n)) return true;
  }
  return false;
}

/**
 * Screen one meal's ingredients against everyone eating it.
 *
 * `people` is who the entry is for — one person for a packed lunch, the whole
 * household for a dinner. Passing the wrong set is the way to get a false
 * all-clear, so callers resolve it from the plan entry rather than defaulting.
 */
export function screenMeal(
  ingredients: { name: string }[],
  people: ScreenablePerson[],
): MealScreen {
  const readable = ingredients.filter((i) => normalise(i.name).length > 0);
  const checked = ingredients.length > 0 && readable.length === ingredients.length;

  const allergens: AllergenHit[] = [];
  const dislikes: DislikeHit[] = [];

  for (const person of people) {
    for (const ingredient of readable) {
      for (const allergen of person.allergies) {
        if (mentions(ingredient.name, allergen)) {
          allergens.push({
            personId: person.id,
            personName: person.name,
            allergen,
            ingredient: ingredient.name,
          });
        }
      }
      for (const dislike of person.dislikes) {
        if (mentions(ingredient.name, dislike)) {
          dislikes.push({
            personId: person.id,
            personName: person.name,
            dislike,
            ingredient: ingredient.name,
          });
        }
      }
    }
  }

  return { allergens, dislikes, checked };
}

/**
 * One line for a screen result, or null when there is nothing to say.
 *
 * Allergens always lead and always name the person and the ingredient: "not
 * suitable" tells someone to look elsewhere, "contains Peanut Butter — Ella is
 * allergic to Peanut" tells them what to do about it.
 */
export function describeScreen(screen: MealScreen): string | null {
  if (screen.allergens.length > 0) {
    const byPerson = new Map<string, AllergenHit[]>();
    for (const hit of screen.allergens) {
      const list = byPerson.get(hit.personName);
      if (list) list.push(hit);
      else byPerson.set(hit.personName, [hit]);
    }
    return [...byPerson.entries()]
      .map(([name, hits]) => {
        const items = [...new Set(hits.map((h) => h.ingredient))].join(", ");
        const what = [...new Set(hits.map((h) => h.allergen))].join(", ");
        return `${name} is allergic to ${what} — this has ${items}`;
      })
      .join("; ");
  }
  if (screen.dislikes.length > 0) {
    const names = [...new Set(screen.dislikes.map((d) => d.personName))].join(", ");
    const items = [...new Set(screen.dislikes.map((d) => d.ingredient))].join(", ");
    return `${names} won't eat ${items}`;
  }
  return null;
}
