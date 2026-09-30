import { describe, expect, it } from "vitest";
import { reportLabel, reportSchema } from "./model";

describe("reports feature", () => {
  it("validates and presents a report", () => {
    const report = reportSchema.parse({ id: "r-1", title: "Quality summary" });
    expect(reportLabel(report)).toBe("r-1: Quality summary");
  });

  it("rejects malformed reports", () => {
    expect(() => reportSchema.parse({ id: 1 })).toThrow();
  });
});