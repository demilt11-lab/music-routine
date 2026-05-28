import { describe, expect, it } from "vitest";
import { energyTags } from "./index.js";

describe("energyTags", () => {
  it("maps high energy to upbeat tags", () => {
    expect(energyTags({ min: 0.8, max: 0.95 })).toContain("energetic");
  });

  it("maps low energy to calm tags", () => {
    expect(energyTags({ min: 0.05, max: 0.2 })).toContain("ambient");
  });

  it("returns nothing without an energy band", () => {
    expect(energyTags(undefined)).toEqual([]);
  });
});
