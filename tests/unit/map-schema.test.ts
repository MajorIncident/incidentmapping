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

  it("validates and serializes optional incident metadata", () => {
    const metadata = {
      title: "Investigation",
      incidentId: "INC-204",
      occurredAt: "2026-08-16T09:30",
      location: "Plant 4",
      severity: "Critical" as const,
      status: "Open" as const,
    };
    expect(mapDataSchema.parse({ ...sampleMap, metadata }).metadata).toEqual(
      metadata,
    );

    expect(
      mapDataSchema.safeParse({
        ...sampleMap,
        metadata: { ...metadata, location: "   " },
      }).success,
    ).toBe(false);
    expect(
      mapDataSchema.safeParse({
        ...sampleMap,
        metadata: { ...metadata, severity: "Urgent" },
      }).success,
    ).toBe(false);
  });

  it("rejects retired node-level incident status", () => {
    const result = mapDataSchema.safeParse({
      ...sampleMap,
      nodes: sampleMap.nodes.map((node, index) =>
        index === 0 ? { ...node, incidentStatus: "Open" } : node,
      ),
    });
    expect(result.success).toBe(false);
  });

  it("accepts non-contiguous canonical evidence IDs and their high-water mark", () => {
    const parsed = mapDataSchema.parse({
      ...sampleMap,
      metadata: { evidenceReferenceHighWaterMark: 3 },
      nodes: sampleMap.nodes.map((node, index) => ({
        ...node,
        evidenceItems: [
          {
            id: index === 0 ? "EV-001" : "EV-003",
            text: `Evidence ${index + 1}`,
          },
        ],
      })),
    });
    expect(parsed.nodes.flatMap((node) => node.evidenceItems)).toEqual([
      { id: "EV-001", text: "Evidence 1" },
      { id: "EV-003", text: "Evidence 2" },
    ]);
    expect(parsed.metadata?.evidenceReferenceHighWaterMark).toBe(3);
  });

  it.each(["Effective", "Degraded", "Failed", "Missing"] as const)(
    "accepts the %s barrier status without retired fields",
    (status) => {
      const barrier = { ...sampleMap.barriers[0], status };
      const parsed = mapDataSchema.parse({ ...sampleMap, barriers: [barrier] });
      expect(parsed.barriers[0].status).toBe(status);
      expect(parsed.barriers[0]).not.toHaveProperty("breached");
      expect(parsed.barriers[0]).not.toHaveProperty("breachedItems");
    },
  );

  it.each([
    [
      "Duplicate node ID",
      (map: typeof sampleMap) => ({
        ...map,
        nodes: [...map.nodes, { ...map.nodes[0] }],
      }),
    ],
    [
      "Duplicate node reference ID",
      (map: typeof sampleMap) => ({
        ...map,
        nodes: map.nodes.map((node, index) =>
          index ? { ...node, referenceId: map.nodes[0].referenceId } : node,
        ),
      }),
    ],
    [
      "Duplicate edge ID",
      (map: typeof sampleMap) => ({
        ...map,
        edges: [...map.edges, { ...map.edges[0] }],
      }),
    ],
    [
      "Duplicate control ID",
      (map: typeof sampleMap) => ({
        ...map,
        barriers: [...map.barriers, { ...map.barriers[0] }],
      }),
    ],
    [
      "Duplicate evidence ID",
      (map: typeof sampleMap) => ({
        ...map,
        nodes: map.nodes.map((node) => ({
          ...node,
          evidenceItems: [{ id: "EV-001", text: "proof" }],
        })),
      }),
    ],
  ] as const)("reports %s", (message, mutate) => {
    const result = mapDataSchema.safeParse(mutate(sampleMap));
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.some((item) => item.message.startsWith(message)),
      ).toBe(true);
  });

  it("rejects invalid Action and causal relationships", () => {
    const action = {
      ...sampleMap.nodes[1],
      id: "action",
      referenceId: "N-003",
      nodeType: "Action" as const,
    };
    const orphan = { ...sampleMap, nodes: [...sampleMap.nodes, action] };
    const orphanResult = mapDataSchema.safeParse(orphan);
    expect(
      orphanResult.success
        ? []
        : orphanResult.error.issues.map((item) => item.message),
    ).toContain("Orphaned Action: action");
    const causal = {
      ...orphan,
      edges: [
        ...orphan.edges,
        {
          id: "bad",
          kind: "CauseEffectEdge" as const,
          fromId: "child",
          toId: "action",
        },
      ],
    };
    const causalResult = mapDataSchema.safeParse(causal);
    expect(
      causalResult.success
        ? []
        : causalResult.error.issues.map((item) => item.message),
    ).toContain("Causal edge touches Action node: bad");
  });
});
