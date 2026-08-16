import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(`${process.cwd()}/tests/fixtures/${name}`, "utf8"));

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

  it("keeps the committed Version 1 baggage investigation content", () => {
    const migrated = parseAndMigrateMapData(
      fixture("baggage-incident-v1.json"),
    );
    expect(migrated.nodes[0]).toMatchObject({
      referenceId: "N-001",
      nodeType: "Event",
      description: "Passengers waited beyond the service target.",
      owner: "Station manager",
      timestamp: "2026-06-14T18:42:00Z",
      negativeConsequenceBulletPoints: [
        "Forty-two passengers affected",
        "Connections put at risk",
      ],
    });
    expect(migrated.barriers[0]).toMatchObject({
      status: "Failed",
      failureDetails:
        "Inspection did not include the photo-eye\nNo escalation recorded",
    });
  });

  it("accepts the comprehensive committed Version 2 baggage fixture", () => {
    const parsed = parseAndMigrateMapData(fixture("baggage-incident-v2.json"));
    expect(new Set(parsed.nodes.map((node) => node.nodeType))).toEqual(
      new Set(["Impact", "Event", "Factor", "Action"]),
    );
    expect(new Set(parsed.edges.map((edge) => edge.kind))).toEqual(
      new Set(["CauseEffectEdge", "ActionEdge"]),
    );
    expect(
      new Set(
        parsed.nodes
          .filter((node) => node.nodeType === "Factor")
          .map((node) => node.factorCategory),
      ),
    ).toEqual(
      new Set([
        "Human",
        "Equipment",
        "Environment",
        "Procedure",
        "Organization",
      ]),
    );
    expect(
      new Set(
        parsed.nodes
          .filter((node) => node.nodeType === "Factor")
          .map((node) => node.factorSignificance),
      ),
    ).toEqual(new Set(["Normal", "KeyFactor", "RootCause"]));
    expect(parsed.nodes.filter((node) => node.nodeType === "Factor")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factorCategory: "Human",
          factorSignificance: "KeyFactor",
        }),
        expect.objectContaining({
          factorCategory: "Procedure",
          factorSignificance: "RootCause",
          evidenceItems: expect.arrayContaining([
            expect.objectContaining({ id: "E-2" }),
          ]),
        }),
      ]),
    );
    expect(parsed.barriers[0]).toMatchObject({
      status: "Failed",
      failureReason: "Inadequate",
    });
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
