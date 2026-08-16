import type { MapData } from "./schema";

export const sampleMap: MapData = {
  schemaVersion: 3,
  metadata: { title: "Sample Incident Chain", contextItems: [] },
  nodes: [
    {
      id: "root",
      kind: "ChainNode",
      referenceId: "N-001",
      nodeType: "Event",
      title: "Root Event",
      positiveConsequenceBulletPoints: [],
      negativeConsequenceBulletPoints: [],
      evidenceIds: [],
      contextItems: [],
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
      evidenceIds: [],
      contextItems: [],
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
      evidenceIds: [],
    },
  ],
  evidence: [],
};

export const emptyMap: MapData = {
  schemaVersion: 3,
  metadata: { title: "Untitled Map", contextItems: [] },
  nodes: [],
  edges: [],
  barriers: [],
  evidence: [],
};
