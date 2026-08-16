import { describe, expect, it } from "vitest";
import { parseAndMigrateMapData } from "../../src/features/maps/migration";
import { mapDataSchema, type MapDataV1 } from "../../src/features/maps/schema";
import { useAppStore } from "../../src/state/useAppStore";

const legacy: MapDataV1 = {
  schemaVersion: 1,
  metadata: { title: "Original investigation" },
  nodes: [
    {
      id: "later",
      kind: "ChainNode",
      title: "Second chronologically",
      description: "description",
      owner: "owner",
      timestamp: "2024-01-02",
      positiveConsequenceBulletPoints: ["positive"],
      negativeConsequenceBulletPoints: ["negative"],
      position: { x: 13, y: 29 },
    },
    {
      id: "earlier",
      kind: "ChainNode",
      title: "First chronologically",
      positiveConsequenceBulletPoints: [],
      negativeConsequenceBulletPoints: [],
      position: { x: -8, y: 3 },
    },
  ],
  edges: [
    { id: "edge", kind: "CauseEffectEdge", fromId: "earlier", toId: "later" },
  ],
  barriers: [
    {
      id: "failed",
      kind: "Barrier",
      upstreamNodeId: "earlier",
      downstreamNodeId: "later",
      description: "Control",
      breached: true,
      breachedItems: ["First failure", "", "Second failure"],
    },
    {
      id: "effective",
      kind: "Barrier",
      upstreamNodeId: "later",
      downstreamNodeId: "earlier",
      breached: false,
      breachedItems: [],
    },
  ],
};

describe("parseAndMigrateMapData", () => {
  it("preserves V1 content while deterministically adding V2 fields", () => {
    const migrated = parseAndMigrateMapData(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.metadata).toEqual({
      ...legacy.metadata,
      nodeReferenceHighWaterMark: legacy.nodes.length,
    });
    expect(migrated.nodes.map(({ referenceId }) => referenceId)).toEqual([
      "N-001",
      "N-002",
    ]);
    expect(migrated.nodes[0]).toMatchObject({
      ...legacy.nodes[0],
      nodeType: "Event",
      evidenceItems: [],
    });
    expect(migrated.edges).toEqual(legacy.edges);
    expect(migrated.barriers).toEqual([
      {
        id: "failed",
        kind: "Barrier",
        upstreamNodeId: "earlier",
        downstreamNodeId: "later",
        description: "Control",
        status: "Failed",
        failureDetails: "First failure\nSecond failure",
      },
      {
        id: "effective",
        kind: "Barrier",
        upstreamNodeId: "later",
        downstreamNodeId: "earlier",
        status: "Effective",
      },
    ]);
  });

  it("accepts strict V2 data and rejects retired fields", () => {
    const current = parseAndMigrateMapData(legacy);
    expect(parseAndMigrateMapData(current)).toEqual(current);
    expect(
      mapDataSchema.safeParse({
        ...current,
        barriers: [{ ...current.barriers[0], breached: true }],
      }).success,
    ).toBe(false);
  });

  it("fails clearly for unknown versions", () => {
    expect(() => parseAndMigrateMapData({ schemaVersion: 99 })).toThrow(
      "Unsupported map schema version: 99",
    );
  });

  it("round trips V2 through the store without retired barrier fields", () => {
    const migrated = parseAndMigrateMapData(legacy);
    useAppStore.getState().actions.loadMap(migrated);
    const saved = useAppStore.getState().actions.toMap();
    expect(saved.schemaVersion).toBe(2);
    expect(JSON.stringify(saved)).not.toMatch(/breached(?:Items)?/);
    expect(parseAndMigrateMapData(saved)).toEqual(saved);
    expect(useAppStore.getState().history).toEqual({ past: [], future: [] });
    expect(useAppStore.getState().canUndo).toBe(false);
  });
});
