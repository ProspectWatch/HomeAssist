/**
 * The shape of a planned week.
 *
 * Dates are handled as plain YYYY-MM-DD strings throughout, never as Date
 * objects carrying a time. A meal is planned for a day, not an instant, and
 * putting a timestamp on it means a plan made at 9pm in Ontario can land on the
 * wrong day the moment anything reads it as UTC. The database column is a
 * `date` for the same reason.
 */

export const MEAL_SLOTS = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export const SLOT_LABEL: Record<MealSlot, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  SNACK: "Snack",
  DINNER: "Dinner",
};

/** Anything at or under this is offered first on a busy night. */
export const QUICK_MINUTES = 30;

export function isMealSlot(value: string): value is MealSlot {
  return (MEAL_SLOTS as readonly string[]).includes(value);
}

/** YYYY-MM-DD for a Date, read in local terms rather than UTC. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses YYYY-MM-DD as a local date, not a UTC instant. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * The Monday on or before `iso`.
 *
 * Monday because the week this plans is a school week: lunches run Monday to
 * Friday and the weekend is the part that changes shape.
 */
export function weekStart(iso: string): string {
  const date = fromISODate(iso);
  const offset = (date.getDay() + 6) % 7; // Sunday(0) -> 6, Monday(1) -> 0
  date.setDate(date.getDate() - offset);
  return toISODate(date);
}

export function addDays(iso: string, days: number): string {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function weekDays(startIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startIso, i));
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function dayName(iso: string): string {
  return DAY_NAMES[fromISODate(iso).getDay()];
}

export function shortDate(iso: string): string {
  const date = fromISODate(iso);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

/** "Aug 31 – Sep 6", for the header over a week. */
export function describeWeek(startIso: string): string {
  return `${shortDate(startIso)} – ${shortDate(addDays(startIso, 6))}`;
}

export type PlannedMeal = {
  id: string;
  date: string;
  slot: MealSlot;
  recipeId: string | null;
  /** The recipe's name, or the plain line someone typed ("Leftovers"). */
  title: string;
  /** Null means the whole household. */
  personId: string | null;
  personName: string | null;
  timeMinutes: number | null;
  note: string | null;
};

export type DayPlan<T extends PlannedMeal = PlannedMeal> = {
  date: string;
  dayName: string;
  shortDate: string;
  isToday: boolean;
  slots: { slot: MealSlot; label: string; meals: T[] }[];
};

/**
 * Lays the week out as seven days of four slots, including the empty ones.
 *
 * Empty slots are part of the answer: a planner exists to show you the gaps,
 * and one that only renders what is already filled hides exactly the thing you
 * opened it to find.
 */
export function buildWeek<T extends PlannedMeal>(
  startIso: string,
  meals: T[],
  todayIso: string,
): DayPlan<T>[] {
  return weekDays(startIso).map((date) => ({
    date,
    dayName: dayName(date),
    shortDate: shortDate(date),
    isToday: date === todayIso,
    slots: MEAL_SLOTS.map((slot) => ({
      slot,
      label: SLOT_LABEL[slot],
      meals: meals
        .filter((m) => m.date === date && m.slot === slot)
        // Household meals first, then each person's, so a dinner reads before
        // the packed lunches that hang off the same day.
        .sort(
          (a, b) =>
            Number(a.personId !== null) - Number(b.personId !== null) ||
            (a.personName ?? "").localeCompare(b.personName ?? "") ||
            a.title.localeCompare(b.title),
        ),
    })),
  }));
}

/** How full the week is, for a header that says something useful. */
export function weekSummary(days: DayPlan<PlannedMeal>[]): { planned: number; empty: number } {
  let planned = 0;
  let empty = 0;
  for (const day of days) {
    for (const slot of day.slots) {
      if (slot.meals.length > 0) planned += slot.meals.length;
      else empty += 1;
    }
  }
  return { planned, empty };
}
