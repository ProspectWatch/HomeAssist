import { describe, expect, it } from "vitest";
import {
  MAX_PERSON_NAME,
  buildJoinLink,
  describePeople,
  sortPeople,
  validatePersonName,
  type HouseholdPerson,
} from "./people";

function person(overrides: Partial<HouseholdPerson> = {}): HouseholdPerson {
  return {
    allergies: [],
    dislikes: [], id: "p1", name: "Steph", isChild: false, hasLogin: false, ...overrides };
}

describe("naming a person", () => {
  it("accepts an ordinary name and tidies the spacing", () => {
    expect(validatePersonName("  Steph  ")).toEqual({ ok: true, name: "Steph" });
    expect(validatePersonName("Mary  Anne")).toEqual({ ok: true, name: "Mary Anne" });
  });

  it("rejects an empty name", () => {
    expect(validatePersonName("   ").ok).toBe(false);
  });

  it("rejects a name longer than the column allows", () => {
    expect(validatePersonName("x".repeat(MAX_PERSON_NAME + 1)).ok).toBe(false);
    expect(validatePersonName("x".repeat(MAX_PERSON_NAME)).ok).toBe(true);
  });

  // Attribution is read by name, so two the same makes "who was this for"
  // unanswerable at a glance.
  it("rejects a duplicate regardless of case", () => {
    const result = validatePersonName("steph", ["Steph"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("already in the household");
  });

  it("allows a different name alongside existing ones", () => {
    expect(validatePersonName("Ella", ["Steph", "Sam"]).ok).toBe(true);
  });
});

describe("ordering people", () => {
  it("puts adults before children, each alphabetically", () => {
    const sorted = sortPeople([
      person({ id: "a", name: "Sam", isChild: true }),
      person({ id: "b", name: "Steph" }),
      person({ id: "c", name: "Ella", isChild: true }),
      person({ id: "d", name: "Stuart" }),
    ]);
    expect(sorted.map((p) => p.name)).toEqual(["Steph", "Stuart", "Ella", "Sam"]);
  });

  it("does not mutate the input", () => {
    const input = [person({ id: "a", name: "Z" }), person({ id: "b", name: "A" })];
    sortPeople(input);
    expect(input.map((p) => p.name)).toEqual(["Z", "A"]);
  });
});

describe("describing a group", () => {
  it.each([
    [[], ""],
    [["Ella"], "Ella"],
    [["Ella", "Sam"], "Ella and Sam"],
    [["Ella", "Sam", "Theo"], "Ella, Sam and Theo"],
  ])("reads %j as %s", (names, expected) => {
    expect(describePeople(names.map((name) => ({ name })))).toBe(expected);
  });
});

describe("the invite link", () => {
  it("carries the join code so nobody has to retype it", () => {
    expect(buildJoinLink("https://homeassist-flame.vercel.app", "28a030ab")).toBe(
      "https://homeassist-flame.vercel.app/join?code=28a030ab",
    );
  });

  it("tolerates a trailing slash on the site url", () => {
    expect(buildJoinLink("https://example.com/", "abc")).toBe("https://example.com/join?code=abc");
  });

  it("escapes a code that would otherwise break the query string", () => {
    expect(buildJoinLink("https://example.com", "a b&c")).toBe(
      "https://example.com/join?code=a%20b%26c",
    );
  });
});
