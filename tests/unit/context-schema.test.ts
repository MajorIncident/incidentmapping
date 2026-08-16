import { describe, expect, it } from "vitest";
import { mapDataSchema } from "../../src/features/maps/schema";
import { sampleMap } from "../../src/features/maps/fixtures";

describe("Context display schema", () => {
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
