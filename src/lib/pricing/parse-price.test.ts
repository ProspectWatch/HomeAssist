import { describe, expect, it } from "vitest";
import { parsePriceInput } from "./parse-price";

describe("parsePriceInput", () => {
  it("reads the shapes people actually type", () => {
    expect(parsePriceInput("5.49")).toBe(549);
    expect(parsePriceInput("$5.49")).toBe(549);
    expect(parsePriceInput(" 5.49 ")).toBe(549);
    expect(parsePriceInput("5")).toBe(500);
    expect(parsePriceInput(".99")).toBe(99);
    expect(parsePriceInput("1,299.99")).toBe(129999);
  });

  it("rounds sub-cent input rather than truncating it", () => {
    expect(parsePriceInput("5.499")).toBe(550);
  });

  it("treats bare digits as dollars, never as cents", () => {
    expect(parsePriceInput("549")).toBe(54900);
  });

  it("returns null for anything that isn't a positive amount", () => {
    for (const input of ["", " ", ".", "abc", "-5", "5.4.9", "0", "0.00", "1e3", "5%"]) {
      expect(parsePriceInput(input)).toBeNull();
    }
  });
});
