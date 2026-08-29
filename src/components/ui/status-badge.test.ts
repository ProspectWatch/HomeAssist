import { describe, expect, it } from "vitest";
import { statusMeta } from "./status-badge";

describe("statusMeta", () => {
  it("maps every price status to its exact handoff label and color", () => {
    expect(statusMeta("wait")).toEqual({ label: "WAIT", bg: "rgba(29,29,27,.45)" });
    expect(statusMeta("good_price")).toEqual({ label: "GOOD PRICE", bg: "#74876A" });
    expect(statusMeta("target_hit")).toEqual({ label: "TARGET HIT", bg: "#3F7A55" });
    expect(statusMeta("all_time_low")).toEqual({ label: "ALL-TIME LOW", bg: "#B69052" });
    expect(statusMeta("price_dropped")).toEqual({ label: "PRICE DROPPED", bg: "#6E8291" });
  });
});
