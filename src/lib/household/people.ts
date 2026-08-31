/**
 * The people in the household.
 *
 * Deliberately separate from household_members (app logins) and from athletes
 * (a sports facet). A child has no login and may play no sport, but a good
 * share of the shopping is for them — so "who is in this family" needs its own
 * answer, and attribution hangs off it.
 */

export type HouseholdPerson = {
  id: string;
  name: string;
  isChild: boolean;
  /** Set when this person also signs in. Null for children. */
  hasLogin: boolean;
};

export const MAX_PERSON_NAME = 40;

export type PersonNameCheck = { ok: true; name: string } | { ok: false; message: string };

export function validatePersonName(input: string, existing: string[] = []): PersonNameCheck {
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 1) return { ok: false, message: "Give them a name." };
  if (name.length > MAX_PERSON_NAME) {
    return { ok: false, message: `Keep the name under ${MAX_PERSON_NAME} characters.` };
  }
  // Names are the label attribution is read by, so two of the same would make
  // "who was this for" unanswerable at a glance.
  if (existing.some((e) => e.toLowerCase() === name.toLowerCase())) {
    return { ok: false, message: `${name} is already in the household.` };
  }
  return { ok: true, name };
}

/** Adults first, then children, each alphabetically. */
export function sortPeople(people: HouseholdPerson[]): HouseholdPerson[] {
  return [...people].sort(
    (a, b) => Number(a.isChild) - Number(b.isChild) || a.name.localeCompare(b.name),
  );
}

/** "Ella" / "Ella and Sam" / "Ella, Sam and Theo" — how a person reads a list. */
export function describePeople(people: Pick<HouseholdPerson, "name">[]): string {
  const names = people.map((p) => p.name);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The share link that lets someone join without typing a code. */
export function buildJoinLink(siteUrl: string, joinCode: string): string {
  return `${siteUrl.replace(/\/$/, "")}/join?code=${encodeURIComponent(joinCode)}`;
}
