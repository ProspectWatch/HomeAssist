import { describe, expect, it } from "vitest";
import {
  addDays,
  buildWeek,
  describeWeek,
  fromISODate,
  toISODate,
  weekDays,
  weekStart,
  weekSummary,
  type PlannedMeal,
} from "./week";

function meal(overrides: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    id: "m1",
    date: "2026-08-31",
    slot: "DINNER",
    recipeId: null,
    title: "Leftovers",
    personId: null,
    personName: null,
    timeMinutes: null,
    note: null,
    ...overrides,
  };
}

describe("dates stay on the day they were planned for", () => {
  it("round-trips an ISO date through local time", () => {
    expect(toISODate(fromISODate("2026-08-31"))).toBe("2026-08-31");
  });

  it("does not shift a date near midnight in a western timezone", () => {
    // Parsing "2026-01-01" as UTC and reading it locally in Ontario gives
    // Dec 31. A meal planned for New Year's Day has to stay on New Year's Day.
    expect(toISODate(fromISODate("2026-01-01"))).toBe("2026-01-01");
  });

  it("crosses a month boundary", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });
});

describe("weekStart", () => {
  it("returns the Monday on or before a date", () => {
    // 2026-08-31 is a Monday.
    expect(weekStart("2026-08-31")).toBe("2026-08-31");
    expect(weekStart("2026-09-01")).toBe("2026-08-31");
    expect(weekStart("2026-09-06")).toBe("2026-08-31");
  });

  it("treats Sunday as the end of its week, not the start", () => {
    // Sunday is the last day of a school week's plan, not the first.
    expect(weekStart("2026-09-06")).toBe("2026-08-31");
    expect(weekStart("2026-09-07")).toBe("2026-09-07");
  });

  it("gives seven consecutive days starting Monday", () => {
    const days = weekDays(weekStart("2026-09-03"));
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-08-31");
    expect(days[6]).toBe("2026-09-06");
  });
});

describe("describeWeek", () => {
  it("reads across a month boundary", () => {
    expect(describeWeek("2026-08-31")).toBe("Aug 31 – Sep 6");
  });
});

describe("buildWeek", () => {
  it("returns every day and every slot, including the empty ones", () => {
    // The gaps are the point — a planner that only shows filled slots hides
    // what you opened it to find.
    const week = buildWeek("2026-08-31", [], "2026-08-31");
    expect(week).toHaveLength(7);
    expect(week[0].slots.map((s) => s.slot)).toEqual(["BREAKFAST", "LUNCH", "SNACK", "DINNER"]);
    expect(week.every((d) => d.slots.every((s) => s.meals.length === 0))).toBe(true);
  });

  it("files each meal under its own day and slot", () => {
    const week = buildWeek(
      "2026-08-31",
      [
        meal({ id: "a", date: "2026-08-31", slot: "DINNER", title: "Tacos" }),
        meal({ id: "b", date: "2026-09-02", slot: "LUNCH", title: "Sandwich" }),
      ],
      "2026-08-31",
    );
    expect(week[0].slots[3].meals.map((m) => m.title)).toEqual(["Tacos"]);
    expect(week[2].slots[1].meals.map((m) => m.title)).toEqual(["Sandwich"]);
  });

  it("puts the household meal before the individual ones", () => {
    const week = buildWeek(
      "2026-08-31",
      [
        meal({ id: "a", slot: "LUNCH", title: "Ella's wrap", personId: "p1", personName: "Ella" }),
        meal({ id: "b", slot: "LUNCH", title: "Soup for everyone", personId: null }),
        meal({ id: "c", slot: "LUNCH", title: "Sam's pasta", personId: "p2", personName: "Sam" }),
      ],
      "2026-08-31",
    );
    expect(week[0].slots[1].meals.map((m) => m.title)).toEqual([
      "Soup for everyone",
      "Ella's wrap",
      "Sam's pasta",
    ]);
  });

  it("marks today, and only today", () => {
    const week = buildWeek("2026-08-31", [], "2026-09-02");
    expect(week.filter((d) => d.isToday).map((d) => d.date)).toEqual(["2026-09-02"]);
  });

  it("ignores a meal outside the week rather than forcing it in", () => {
    const week = buildWeek("2026-08-31", [meal({ date: "2026-09-20" })], "2026-08-31");
    expect(week.every((d) => d.slots.every((s) => s.meals.length === 0))).toBe(true);
  });
});

describe("weekSummary", () => {
  it("counts planned meals and empty slots", () => {
    const week = buildWeek(
      "2026-08-31",
      [meal({ id: "a" }), meal({ id: "b", slot: "LUNCH", personId: "p1", personName: "Ella" })],
      "2026-08-31",
    );
    // 28 slots, two filled.
    expect(weekSummary(week)).toEqual({ planned: 2, empty: 26 });
  });

  it("counts a slot with two meals as one filled slot", () => {
    const week = buildWeek(
      "2026-08-31",
      [
        meal({ id: "a", slot: "LUNCH", personId: "p1", personName: "Ella" }),
        meal({ id: "b", slot: "LUNCH", personId: "p2", personName: "Sam" }),
      ],
      "2026-08-31",
    );
    expect(weekSummary(week)).toEqual({ planned: 2, empty: 27 });
  });
});
