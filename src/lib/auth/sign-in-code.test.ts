import { describe, expect, it } from "vitest";
import {
  MAX_CODE_LENGTH,
  MIN_CODE_LENGTH,
  isPlausibleSignInCode,
  normalizeSignInCode,
} from "./sign-in-code";

/**
 * The regression this guards: the box demanded exactly six digits while the
 * Supabase project was configured to send eight, so a correct code was
 * rejected before it ever reached the server. Code length is a project
 * setting, not a constant.
 */
describe("sign-in code length", () => {
  it.each([4, 5, 6, 7, 8, 9, 10])("accepts a %s-digit code", (length) => {
    expect(isPlausibleSignInCode("1".repeat(length))).toBe(true);
  });

  it("accepts the eight digits Supabase actually sent", () => {
    expect(isPlausibleSignInCode("12345678")).toBe(true);
  });

  it.each([1, 2, 3])("rejects %s digits as too short to be a code", (length) => {
    expect(isPlausibleSignInCode("1".repeat(length))).toBe(false);
  });

  it("assumes no particular length", () => {
    expect(MIN_CODE_LENGTH).toBeLessThan(6);
    expect(MAX_CODE_LENGTH).toBeGreaterThan(8);
  });
});

describe("normalising what a person pastes", () => {
  it.each([
    ["123456", "123456"],
    ["12345678", "12345678"],
    ["1234 5678", "12345678"],
    ["1234-5678", "12345678"],
    ["  12345678  ", "12345678"],
    ["Code: 12345678", "12345678"],
  ])("reduces %s to its digits", (typed, expected) => {
    expect(normalizeSignInCode(typed)).toBe(expected);
  });

  it("stops at the longest code worth trying", () => {
    expect(normalizeSignInCode("123456789012345")).toHaveLength(MAX_CODE_LENGTH);
  });

  it.each(["", "abcdef", "   "])("yields nothing for %s", (typed) => {
    expect(normalizeSignInCode(typed)).toBe("");
    expect(isPlausibleSignInCode(typed)).toBe(false);
  });
});
