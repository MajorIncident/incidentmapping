import { describe, expect, it } from "vitest";
import {
  contextItemSchema,
  mapDataSchema,
} from "../../src/features/maps/schema";
import { sampleMap } from "../../src/features/maps/fixtures";

describe("Context display schema", () => {
  it("defaults a missing effect to Neutral and rejects unknown effects", () => {
    const item = { id: "a", label: "A", value: "One", displayMode: "Text" };
    expect(contextItemSchema.parse(item).effect).toBe("Neutral");
    expect(
      contextItemSchema.safeParse({ ...item, effect: "Helpful" }).success,
    ).toBe(false);
  });
  it("accepts Chip and optional Metric units but rejects units on Text", () => {
    const withItems = (contextItems: unknown[]) => ({
      ...sampleMap,
      metadata: { ...sampleMap.metadata, contextItems },
    });
    expect(
      mapDataSchema.safeParse(
        withItems([
          { id: "a", label: "A", value: "One", displayMode: "Chip" },
          {
            id: "b",
            label: "B",
            value: "2",
            displayMode: "Metric",
            unit: "units",
          },
        ]),
      ).success,
    ).toBe(true);
    expect(
      mapDataSchema.safeParse(
        withItems([
          { id: "a", label: "A", value: "One", displayMode: "Text", unit: "x" },
        ]),
      ).success,
    ).toBe(false);
  });
});
