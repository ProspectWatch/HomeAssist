import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cron-auth";

describe("isCronAuthorized", () => {
  it("accepts the scheduler's bearer token", () => {
    expect(isCronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("fails closed when no secret is configured", () => {
    // A misconfigured deployment must not run this job for anyone who asks.
    expect(isCronAuthorized("Bearer anything", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer anything", "")).toBe(false);
    expect(isCronAuthorized(null, undefined)).toBe(false);
  });

  it("rejects a missing, empty or malformed header", () => {
    for (const header of [null, undefined, "", "s3cret", "Basic s3cret", "bearer s3cret"]) {
      expect(isCronAuthorized(header, "s3cret")).toBe(false);
    }
  });

  it("rejects a wrong secret, including a prefix of the right one", () => {
    expect(isCronAuthorized("Bearer s3cre", "s3cret")).toBe(false);
    expect(isCronAuthorized("Bearer s3crett", "s3cret")).toBe(false);
    expect(isCronAuthorized("Bearer S3CRET", "s3cret")).toBe(false);
  });
});
