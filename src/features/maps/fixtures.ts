import type { MapData } from "./schema";

export const sampleMap: MapData = {
  schemaVersion: 2,
  metadata: { title: "Sample Incident Chain" },
  nodes: [
    {
      id: "root",
      kind: "ChainNode",
      referenceId: "N-001",
      nodeType: "Event",
      title: "Root Event",
      positiveConsequenceBulletPoints: [],
      negativeConsequenceBulletPoints: [],
      evidenceItems: [],
      position: { x: 0, y: 0 },
    },
    {
      id: "child",
      kind: "ChainNode",
      referenceId: "N-002",
      nodeType: "Event",
      title: "Follow-up Event",
      positiveConsequenceBulletPoints: [],
      negativeConsequenceBulletPoints: [],
      evidenceItems: [],
      position: { x: 0, y: 160 },
    },
  ],
  edges: [
    {
      id: "edge-root-child",
      kind: "CauseEffectEdge",
      fromId: "root",
      toId: "child",
    },
  ],
  barriers: [
    {
      id: "barrier-root-child",
      kind: "Barrier",
      upstreamNodeId: "root",
      downstreamNodeId: "child",
      description: "Firewall between services",
      status: "Effective",
    },
  ],
};

export const emptyMap: MapData = {
  schemaVersion: 2,
  metadata: { title: "Untitled Map" },
  nodes: [],
  edges: [],
  barriers: [],
};
