import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseAndMigrateMapData } from "../../src/features/maps/migration";
import {
  mapDataSchema,
  type MapDataV1,
  type MapDataV2,
} from "../../src/features/maps/schema";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(`${process.cwd()}/tests/fixtures/${name}`, "utf8"));

const v1: MapDataV1 = {
  schemaVersion: 1,
  metadata: { title: "Original investigation" },
  nodes: [
    {
      id: "later",
      kind: "ChainNode",
      title: "Second chronologically",
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
      breached: true,
      breachedItems: ["First failure", "", "Second failure"],
    },
  ],
};

describe("parseAndMigrateMapData", () => {
  it("migrates V1 to deterministic canonical V3 without inferred classifications", () => {
    const migrated = parseAndMigrateMapData(v1);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.metadata).toEqual({
      title: "Original investigation",
      nodeReferenceHighWaterMark: 2,
      evidenceReferenceHighWaterMark: 0,
      contextItems: [],
    });
    expect(migrated.nodes.map((node) => node.referenceId)).toEqual([
      "N-001",
      "N-002",
    ]);
    expect(migrated.nodes[0]).toMatchObject({
      id: "later",
      timestamp: "2024-01-02",
      nodeType: "Event",
      evidenceIds: [],
      contextItems: [],
      position: { x: 13, y: 29 },
    });
    expect(migrated.nodes[0]).not.toHaveProperty("eventPhase");
    expect(migrated.barriers[0]).toEqual({
      id: "failed",
      kind: "Barrier",
      upstreamNodeId: "earlier",
      downstreamNodeId: "later",
      status: "Failed",
      failureDetails: "First failure\nSecond failure",
      evidenceIds: [],
    });
    expect(parseAndMigrateMapData(migrated)).toEqual(migrated);
  });

  it("migrates canonical V2 evidence into the registry while preserving sparse IDs", () => {
    const input = fixture("baggage-incident-v2.json") as MapDataV2;
    if (!input.metadata) throw new Error("Fixture metadata is required");
    input.metadata.evidenceReferenceHighWaterMark = 11;
    input.nodes[0].evidenceItems[0].id = "EV-010";
    const migrated = parseAndMigrateMapData(input);
    expect(migrated.evidence[0]).toEqual({
      id: "EV-010",
      type: "Note",
      title: "Passenger service log records 42 delayed bags",
    });
    expect(migrated.nodes[0].evidenceIds).toEqual(["EV-010"]);
    expect(migrated.metadata?.evidenceReferenceHighWaterMark).toBe(11);
    expect(migrated.barriers[0]).toMatchObject({
      status: "Failed",
      failureReason: "InadequateDesign",
      evidenceIds: [],
    });
    expect(
      migrated.nodes.find((node) => node.nodeType === "Action"),
    ).toMatchObject({
      actionStatus: "Planned",
    });
    expect(migrated.edges.some((edge) => edge.kind === "ActionEdge")).toBe(
      true,
    );
  });

  it("migrates the isolated legacy V2 dialect without changing identities", () => {
    const migrated = parseAndMigrateMapData(
      fixture("baggage-incident-v2-legacy.json"),
    );
    expect(migrated.evidence.map((item) => item.id)).toEqual([
      "EV-001",
      "EV-002",
      "EV-003",
      "EV-004",
    ]);
    expect(migrated.metadata?.evidenceReferenceHighWaterMark).toBe(4);
    expect(
      migrated.nodes.find((node) => node.id === "factor-root"),
    ).toMatchObject({
      factorCategory: "Process",
      factorSignificance: "RootCause",
      evidenceIds: ["EV-003", "EV-004"],
    });
    expect(migrated.nodes.find((node) => node.id === "action")).toMatchObject({
      actionStatus: "Planned",
      actionDueDate: "2026-07-01",
    });
    expect(
      migrated.nodes.find((node) => node.id === "action"),
    ).not.toHaveProperty("actionType");
    expect(migrated.barriers[0]).not.toHaveProperty("controlRole");
  });

  it("rejects duplicate evidence identity instead of renumbering it", () => {
    const input = fixture("baggage-incident-v2.json") as MapDataV2;
    input.nodes[1].evidenceItems[0].id = input.nodes[0].evidenceItems[0].id;
    expect(() => parseAndMigrateMapData(input)).toThrow(
      "Duplicate evidence ID",
    );
  });

  it("passes validated V3 through unchanged", () => {
    const v3 = parseAndMigrateMapData(fixture("baggage-incident-v2.json"));
    expect(mapDataSchema.parse(v3)).toEqual(v3);
    expect(parseAndMigrateMapData(v3)).toEqual(v3);
  });

  it("preserves V1 ordering, relationships, coordinates, narrative, and empty gaps", () => {
    const migrated = parseAndMigrateMapData(v1);
    expect(
      migrated.nodes.map(({ id, title, position }) => ({
        id,
        title,
        position,
      })),
    ).toEqual(
      v1.nodes.map(({ id, title, position }) => ({ id, title, position })),
    );
    expect(migrated.nodes[0].positiveConsequenceBulletPoints).toEqual([
      "positive",
    ]);
    expect(migrated.nodes[0].negativeConsequenceBulletPoints).toEqual([
      "negative",
    ]);
    expect(migrated.edges).toEqual(v1.edges);
    expect(migrated.evidence).toEqual([]);
  });

  it("canonicalizes sparse V2 references without lowering either high-water mark", () => {
    const input = fixture("baggage-incident-v2.json") as MapDataV2;
    if (!input.metadata) throw new Error("Fixture metadata is required");
    input.metadata.nodeReferenceHighWaterMark = 41;
    input.metadata.evidenceReferenceHighWaterMark = 27;
    input.nodes[0].referenceId = "N-099";
    input.nodes[0].evidenceItems[0].id = "EV-019";
    const original = structuredClone(input);

    const migrated = parseAndMigrateMapData(input);

    expect(input).toEqual(original);
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.metadata).toMatchObject({
      nodeReferenceHighWaterMark: 41,
      evidenceReferenceHighWaterMark: 27,
    });
    expect(migrated.nodes[0]).toMatchObject({
      referenceId: "N-099",
      evidenceIds: ["EV-019"],
    });
    expect(migrated.evidence[0]).toMatchObject({
      id: "EV-019",
      type: "Note",
    });
  });

  it("does not rewrite preserved V3 Evidence identity or sparse allocation history", () => {
    const v3 = parseAndMigrateMapData(fixture("baggage-incident-v2.json"));
    const evidence = v3.evidence.map((item, index) => ({
      ...item,
      id: `EV-${String(index * 7 + 3).padStart(3, "0")}`,
    }));
    const idMap = new Map(
      v3.evidence.map((item, index) => [item.id, evidence[index].id]),
    );
    const sparse = {
      ...v3,
      metadata: {
        ...v3.metadata,
        evidenceReferenceHighWaterMark: 90,
        contextItems: v3.metadata?.contextItems ?? [],
      },
      evidence,
      nodes: v3.nodes.map((node) => ({
        ...node,
        evidenceIds: node.evidenceIds.map((id) => idMap.get(id)!),
      })),
    };
    expect(parseAndMigrateMapData(sparse)).toEqual(sparse);
  });

  it("keeps unsupported-version errors explicit", () => {
    expect(() => parseAndMigrateMapData({ schemaVersion: 99 })).toThrow(
      "Unsupported map schema version: 99",
    );
  });
});
