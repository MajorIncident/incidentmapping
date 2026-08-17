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

describe("node Context effect semantics", () => {
  const cases = [
    ["Impact", undefined, true],
    ["Impact", "Neutral", true],
    ["Impact", "Aggravating", true],
    ["Impact", "Mitigating", true],
    ["Event", undefined, true],
    ["Event", "Neutral", true],
    ["Event", "Aggravating", true],
    ["Event", "Mitigating", true],
    ["Factor", undefined, true],
    ["Factor", "Neutral", true],
    ["Factor", "Aggravating", false],
    ["Factor", "Mitigating", false],
    ["Action", undefined, false],
    ["Action", "Neutral", false],
    ["Action", "Aggravating", false],
    ["Action", "Mitigating", false],
  ] as const;

  it.each(cases)(
    "%s with %s effect is accepted: %s",
    (nodeType, effect, accepted) => {
      const contextItem = {
        id: "weather",
        label: "Weather",
        value: "Rain",
        displayMode: "Text" as const,
        ...(effect === undefined ? {} : { effect }),
      };
      const candidate = {
        ...sampleMap,
        nodes: sampleMap.nodes.map((node, index) =>
          index === 0
            ? {
                ...node,
                nodeType,
                eventDisplay: nodeType === "Event" ? "Map" : undefined,
                factorSignificance:
                  nodeType === "Factor" ? "Normal" : undefined,
                contextItems: [contextItem],
              }
            : node,
        ),
      };
      const result = mapDataSchema.safeParse(candidate);
      expect(result.success).toBe(accepted);
      if (!accepted && !result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              message: `${nodeType} Context item "Weather" does not support effect "${effect ?? "Neutral"}"`,
            }),
          ]),
        );
      }
    },
  );
});
