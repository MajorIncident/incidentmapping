import type { MapData } from "./schema";

export const sampleMap: MapData = {
  schemaVersion: 5,
  metadata: {
    title: "Sample Incident Chain",
    contextItems: [],
    controlReferenceHighWaterMark: 1,
    attachmentReferenceHighWaterMark: 0,
  },
  nodes: [
    {
      id: "root",
      kind: "ChainNode",
      referenceId: "N-001",
      nodeType: "Event",
      eventDisplay: "Map",
      title: "Root Event",
      evidenceIds: [],
      contextItems: [],
      position: { x: 0, y: 0 },
    },
    {
      id: "child",
      kind: "ChainNode",
      referenceId: "N-002",
      nodeType: "Event",
      eventDisplay: "Map",
      title: "Follow-up Event",
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
      referenceId: "C-001",
      evidenceIds: [],
    },
  ],
  evidence: [],
  attachments: [],
};

export const emptyMap: MapData = {
  schemaVersion: 5,
  metadata: {
    title: "Untitled Map",
    contextItems: [],
    controlReferenceHighWaterMark: 0,
    attachmentReferenceHighWaterMark: 0,
  },
  nodes: [],
  edges: [],
  barriers: [],
  evidence: [],
  attachments: [],
};
