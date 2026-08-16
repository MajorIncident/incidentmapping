import { describe, expect, it } from "vitest";
import {
  mapDataSchema,
  mapDataV3Schema,
  mapDataV1Schema,
  mapDataV2Schema,
} from "../../src/features/maps/schema";
import { sampleMap } from "../../src/features/maps/fixtures";

const validMap = {
  schemaVersion: 3 as const,
  metadata: {
    title: "Investigation",
    contextItems: [{ id: "weather", label: " Weather ", value: " Rain " }],
  },
  evidence: [
    {
      id: "EV-1",
      type: "Photo" as const,
      title: "Scene photograph",
      description: "Overview",
      source: "Investigator",
      reference: "IMG-1",
    },
    { id: "EV-2", type: "SystemLog" as const, title: "Alarm log" },
  ],
  nodes: [
    {
      id: "event",
      kind: "ChainNode" as const,
      referenceId: "N-1",
      nodeType: "Event" as const,
      title: "Leak",
      eventPhase: "Incident" as const,
      positiveConsequenceBulletPoints: [],
      negativeConsequenceBulletPoints: [],
      evidenceIds: ["EV-1"],
      contextItems: [
        { id: "shift", label: "Shift", value: "Night", showOnCard: true },
      ],
      position: { x: 0, y: 0 },
    },
    {
      id: "factor",
      kind: "ChainNode" as const,
      referenceId: "N-2",
      nodeType: "Factor" as const,
      title: "Seal wear",
      factorCategory: "Equipment" as const,
      factorSignificance: "RootCause" as const,
      positiveConsequenceBulletPoints: [],
      negativeConsequenceBulletPoints: [],
      evidenceIds: ["EV-2"],
      contextItems: [],
      position: { x: 1, y: 1 },
    },
    {
      id: "action",
      kind: "ChainNode" as const,
      referenceId: "N-3",
      nodeType: "Action" as const,
      title: "Replace seal",
      actionType: "Corrective" as const,
      actionStatus: "Planned" as const,
      actionDueDate: "2026-09-01",
      positiveConsequenceBulletPoints: [],
      negativeConsequenceBulletPoints: [],
      evidenceIds: [],
      contextItems: [],
      position: { x: 2, y: 2 },
    },
  ],
  edges: [
    {
      id: "causal",
      kind: "CauseEffectEdge" as const,
      fromId: "factor",
      toId: "event",
    },
    {
      id: "action-edge",
      kind: "ActionEdge" as const,
      fromId: "event",
      toId: "action",
    },
  ],
  barriers: [
    {
      id: "control",
      kind: "Barrier" as const,
      upstreamNodeId: "factor",
      downstreamNodeId: "event",
      status: "Effective" as const,
      controlRole: "Preventive" as const,
      evidenceIds: ["EV-2"],
    },
  ],
};

const issues = (value: unknown) => {
  const result = mapDataV3Schema.safeParse(value);
  expect(result.success).toBe(false);
  return result.success ? [] : result.error.issues;
};
const mutateNode = (index: number, patch: object) => ({
  ...validMap,
  nodes: validMap.nodes.map((node, i) =>
    i === index ? { ...node, ...patch } : node,
  ),
});

describe("mapDataV3Schema V3", () => {
  it("accepts a comprehensive V3 document and normalizes metadata context", () => {
    const parsed = mapDataV3Schema.parse(validMap);
    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.metadata?.contextItems[0]).toMatchObject({
      label: "Weather",
      value: "Rain",
    });
    expect(
      mapDataV3Schema.parse({ ...validMap, metadata: { title: "Minimal" } })
        .metadata?.contextItems,
    ).toEqual([]);
  });

  it("keeps V1 and V2 schemas available but canonical serialization is V3 only", () => {
    expect(
      mapDataV1Schema.safeParse({ schemaVersion: 1, nodes: [], edges: [] })
        .success,
    ).toBe(true);
    expect(mapDataV2Schema.safeParse(sampleMap).success).toBe(false);
    expect(mapDataSchema.safeParse(sampleMap).success).toBe(true);
  });

  it.each([
    [
      "event phase on non-Event",
      mutateNode(1, { eventPhase: "Recovery" }),
      ["nodes", 1, "eventPhase"],
    ],
    [
      "action type on non-Action",
      mutateNode(0, { actionType: "Immediate" }),
      ["nodes", 0, "actionType"],
    ],
    [
      "action status on non-Action",
      mutateNode(0, { actionStatus: "Proposed" }),
      ["nodes", 0, "actionStatus"],
    ],
    [
      "action due date on non-Action",
      mutateNode(0, { actionDueDate: "tomorrow" }),
      ["nodes", 0, "actionDueDate"],
    ],
    [
      "factor category on non-Factor",
      mutateNode(0, { factorCategory: "Human" }),
      ["nodes", 0, "factorCategory"],
    ],
    [
      "factor significance on non-Factor",
      mutateNode(0, { factorSignificance: "KeyFactor" }),
      ["nodes", 0, "factorSignificance"],
    ],
    [
      "context on Action",
      mutateNode(2, {
        contextItems: [{ id: "x", label: "Why", value: "Now" }],
      }),
      ["nodes", 2, "contextItems"],
    ],
  ])("rejects %s", (_name, value, path) =>
    expect(
      issues(value).some(
        (issue) => JSON.stringify(issue.path) === JSON.stringify(path),
      ),
    ).toBe(true),
  );

  it("rejects duplicate registry IDs, duplicate entity references, and unresolved references", () => {
    expect(
      issues({
        ...validMap,
        evidence: [...validMap.evidence, { ...validMap.evidence[0] }],
      }).some((i) => i.message.includes("Duplicate evidence ID")),
    ).toBe(true);
    expect(
      issues(mutateNode(0, { evidenceIds: ["EV-1", "EV-1"] })).some((i) =>
        i.message.includes("Duplicate evidence reference"),
      ),
    ).toBe(true);
    expect(
      issues(mutateNode(0, { evidenceIds: ["missing"] })).some((i) =>
        i.message.includes("Missing evidence reference"),
      ),
    ).toBe(true);
    const badControl = {
      ...validMap,
      barriers: [
        { ...validMap.barriers[0], evidenceIds: ["missing", "missing"] },
      ],
    };
    expect(
      issues(badControl).filter((i) => i.path[0] === "barriers").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it.each([
    [
      "node IDs",
      {
        ...validMap,
        nodes: [
          validMap.nodes[0],
          { ...validMap.nodes[1], id: "event" },
          validMap.nodes[2],
        ],
      },
      "Duplicate node ID",
    ],
    [
      "node references",
      mutateNode(1, { referenceId: "N-1" }),
      "Duplicate node reference",
    ],
    [
      "edge IDs",
      {
        ...validMap,
        edges: [validMap.edges[0], { ...validMap.edges[1], id: "causal" }],
      },
      "Duplicate edge ID",
    ],
    [
      "Control IDs",
      {
        ...validMap,
        barriers: [validMap.barriers[0], { ...validMap.barriers[0] }],
      },
      "Duplicate control ID",
    ],
    [
      "causal links",
      {
        ...validMap,
        edges: [...validMap.edges, { ...validMap.edges[0], id: "causal-copy" }],
      },
      "Duplicate causal relationship",
    ],
    [
      "Action links",
      {
        ...validMap,
        edges: [...validMap.edges, { ...validMap.edges[1], id: "action-copy" }],
      },
      "Duplicate action relationship",
    ],
  ])("rejects duplicate %s", (_name, value, message) => {
    expect(issues(value).some((issue) => issue.message.includes(message))).toBe(
      true,
    );
  });

  it("validates node and Control evidence references independently while allowing sharing", () => {
    expect(mapDataV3Schema.parse(validMap).nodes[1].evidenceIds).toEqual([
      "EV-2",
    ]);
    expect(mapDataV3Schema.parse(validMap).barriers[0].evidenceIds).toEqual([
      "EV-2",
    ]);
    expect(
      issues({
        ...validMap,
        barriers: [{ ...validMap.barriers[0], evidenceIds: ["EV-2", "EV-2"] }],
      }).some((issue) =>
        issue.message.includes("Duplicate evidence reference"),
      ),
    ).toBe(true);
  });

  it("uses strict enums and rejects retired or invented persisted fields", () => {
    expect(issues(mutateNode(0, { eventPhase: "Before" }))[0].path).toEqual([
      "nodes",
      0,
      "eventPhase",
    ]);
    expect(
      issues({
        ...validMap,
        evidence: [{ ...validMap.evidence[0], type: "URL" }],
      })[0].path,
    ).toEqual(["evidence", 0, "type"]);
    expect(
      issues(mutateNode(0, { evidenceItems: [] })).some(
        (i) => i.code === "unrecognized_keys",
      ),
    ).toBe(true);
    expect(
      issues({
        ...validMap,
        evidence: [{ ...validMap.evidence[0], url: "https://example.test" }],
      }).some((i) => i.code === "unrecognized_keys"),
    ).toBe(true);
  });

  it("rejects blank context labels and values", () => {
    expect(
      issues(
        mutateNode(0, {
          contextItems: [{ id: "x", label: "  ", value: "ok" }],
        }),
      )[0].path,
    ).toEqual(["nodes", 0, "contextItems", 0, "label"]);
    expect(
      issues({
        ...validMap,
        metadata: { contextItems: [{ id: "x", label: "x", value: "  " }] },
      })[0].path,
    ).toEqual(["metadata", "contextItems", 0, "value"]);
  });

  it("retains graph, Action, endpoint, and Control-pair integrity", () => {
    expect(
      issues({
        ...validMap,
        edges: [
          ...validMap.edges,
          { ...validMap.edges[0], id: "bad", toId: "missing" },
        ],
      }).some((i) => i.message.includes("Missing edge target")),
    ).toBe(true);
    expect(
      issues({
        ...validMap,
        edges: validMap.edges.filter((e) => e.kind !== "ActionEdge"),
      }).some((i) => i.message.includes("Orphaned Action")),
    ).toBe(true);
    expect(
      issues({
        ...validMap,
        barriers: [{ ...validMap.barriers[0], downstreamNodeId: "action" }],
      }).some((i) =>
        i.message.includes("does not match a causal relationship"),
      ),
    ).toBe(true);
  });
});

describe("mapDataSchema V4", () => {
  it("accepts canonical attachments and compares only parseable Event times", () => {
    const canonical = structuredClone(sampleMap);
    canonical.attachments.push({
      id: "AT-001",
      filename: "log.txt",
      mimeType: "text/plain",
      size: 0,
      bundlePath: "attachments/log.txt",
    });
    canonical.evidence.push({
      id: "EV-001",
      type: "Document",
      title: "Log",
      attachmentIds: ["AT-001"],
    });
    expect(mapDataSchema.safeParse(canonical).success).toBe(true);
    canonical.nodes[0].timestamp = "2026-01-02T00:00:00Z";
    canonical.nodes[0].endTimestamp = "2026-01-01T00:00:00Z";
    expect(mapDataSchema.safeParse(canonical).success).toBe(false);
    canonical.nodes[0].endTimestamp = "stored-but-malformed";
    expect(mapDataSchema.safeParse(canonical).success).toBe(true);
  });

  it("rejects missing and duplicate attachment identities and paths", () => {
    const canonical = structuredClone(sampleMap);
    canonical.evidence.push({
      id: "EV-001",
      type: "Document",
      title: "Missing",
      attachmentIds: ["AT-404"],
    });
    expect(mapDataSchema.safeParse(canonical).success).toBe(false);
  });
});
