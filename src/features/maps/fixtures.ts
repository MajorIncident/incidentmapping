import type { MapData } from "./schema";

export const sampleMap: MapData = {
  schemaVersion: 1,
  metadata: { title: "Sample Incident Chain" },
  nodes: [
    {
      id: "root",
      kind: "ChainNode",
      title: "Root Event",
      positiveConsequenceBulletPoints: [],
      negativeConsequenceBulletPoints: [],
      position: { x: 0, y: 0 },
    },
    {
      id: "child",
      kind: "ChainNode",
      title: "Follow-up Event",
      positiveConsequenceBulletPoints: [],
      negativeConsequenceBulletPoints: [],
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
};

export const emptyMap: MapData = {
  schemaVersion: 1,
  metadata: { title: "Untitled Map" },
  nodes: [],
  edges: [],
};
