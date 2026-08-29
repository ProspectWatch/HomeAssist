import { describe, expect, it } from "vitest";
import { formatCents } from "./money";

describe("formatCents", () => {
  it("returns an em dash for null/undefined", () => {
    expect(formatCents(null)).toBe("—");
    expect(formatCents(undefined)).toBe("—");
  });

  it("formats whole-dollar amounts without decimals", () => {
    expect(formatCents(500000)).toBe("$5,000");
  });

  it("formats fractional amounts with two decimals", () => {
    expect(formatCents(1999)).toBe("$19.99");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0");
  });
});
