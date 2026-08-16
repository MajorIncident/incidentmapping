import { describe, expect, it } from "vitest";
import { mapDataSchema } from "../../src/features/maps/schema";
import { sampleMap } from "../../src/features/maps/fixtures";

describe("mapDataSchema", () => {
  it("validates a happy path map", () => {
    expect(() => mapDataSchema.parse(sampleMap)).not.toThrow();
  });

  it("rejects missing node titles", () => {
    const invalid = {
      ...sampleMap,
      nodes: sampleMap.nodes.map((node, index) =>
        index === 0 ? { ...node, title: "" } : node,
      ),
    };

    const result = mapDataSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("persists evidence as non-empty id and text pairs", () => {
    const valid = {
      ...sampleMap,
      nodes: sampleMap.nodes.map((node, index) =>
        index === 0
          ? { ...node, evidenceItems: [{ id: "opaque-id", text: "Photo" }] }
          : node,
      ),
    };
    expect(mapDataSchema.parse(valid).nodes[0].evidenceItems).toEqual([
      { id: "opaque-id", text: "Photo" },
    ]);

    valid.nodes[0].evidenceItems = [{ id: "opaque-id", text: "   " }];
    expect(mapDataSchema.safeParse(valid).success).toBe(false);
  });
});
