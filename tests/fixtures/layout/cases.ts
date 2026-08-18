import type {
  InvestigationLayoutInput,
  SemanticNodeKind,
} from "../../../src/features/layout/layoutModel";

const semantic = (
  id: string,
  kind: SemanticNodeKind,
  x: number,
  y: number,
  height = 144,
) => ({ id, kind, position: { x, y }, dimensions: { width: 240, height } });
const causal = (fromId: string, toId: string) => ({
  id: `${fromId}-${toId}`,
  kind: "Causal" as const,
  fromId,
  toId,
});
const action = (id: string, attachedToId: string, height = 128) => ({
  id,
  kind: "Action" as const,
  attachedToId,
  dimensions: { width: 240, height },
});

export const mu566Like: InvestigationLayoutInput = {
  nodes: [
    semantic("impact", "Impact", 520, 0, 168),
    semantic("event", "Event", 520, 280),
    semantic("factor-a", "Factor", 240, 600, 176),
    semantic("factor-b", "Factor", 800, 600, 136),
    semantic("root-a", "Factor", 80, 920, 208),
    semantic("root-b", "Factor", 520, 920, 152),
  ],
  relationships: [
    causal("event", "impact"),
    causal("factor-a", "event"),
    causal("factor-b", "event"),
    causal("root-a", "factor-a"),
    causal("root-b", "factor-a"),
    causal("root-b", "factor-b"),
  ],
  controls: [
    {
      id: "c1",
      kind: "Control",
      relationshipId: "event-impact",
      upstreamNodeId: "event",
      downstreamNodeId: "impact",
      dimensions: { width: 220, height: 112 },
    },
    {
      id: "c2",
      kind: "Control",
      relationshipId: "factor-a-event",
      upstreamNodeId: "factor-a",
      downstreamNodeId: "event",
      dimensions: { width: 240, height: 136 },
    },
    {
      id: "c3",
      kind: "Control",
      relationshipId: "factor-b-event",
      upstreamNodeId: "factor-b",
      downstreamNodeId: "event",
      dimensions: { width: 210, height: 104 },
    },
  ],
  actions: [
    action("action-a", "root-a", 144),
    action("action-b", "root-b", 144),
    action("action-c", "factor-a", 176),
    action("action-d", "factor-b", 112),
  ],
};

export const sq600Like: InvestigationLayoutInput = {
  ...mu566Like,
  nodes: [
    ...mu566Like.nodes,
    semantic("branch-c", "Event", 1080, 600),
    semantic("root-c", "Factor", 1080, 920),
  ],
  relationships: [
    ...mu566Like.relationships,
    causal("branch-c", "event"),
    causal("root-c", "branch-c"),
  ],
  actions: [],
};

export const vehicleLike: InvestigationLayoutInput = {
  nodes: [
    semantic("impact", "Impact", 400, 0),
    semantic("event", "Event", 400, 300),
    semantic("factor", "Factor", 400, 600, 184),
  ],
  relationships: [causal("event", "impact"), causal("factor", "event")],
  controls: [
    {
      id: "control",
      kind: "Control",
      relationshipId: "factor-event",
      upstreamNodeId: "factor",
      downstreamNodeId: "event",
    },
  ],
  actions: Array.from({ length: 4 }, (_, index) =>
    action(`repair-${index}`, "factor", 112 + index * 16),
  ),
};

export const titanicLike: InvestigationLayoutInput = {
  nodes: [
    semantic("impact-a", "Impact", 300, 0, 176),
    semantic("impact-b", "Impact", 800, 0, 152),
    semantic("event-a", "Event", 300, 320),
    semantic("event-b", "Event", 800, 320, 184),
    semantic("key-a", "Factor", 100, 680, 192),
    semantic("key-b", "Factor", 500, 680),
    semantic("root-a", "Factor", 900, 680, 216),
    semantic("root-b", "Factor", 500, 1000, 160),
    {
      ...semantic("timeline-a", "Event", -900, 200),
      eventDisplay: "ChronologyOnly",
    },
    {
      ...semantic("timeline-b", "Event", -900, 500),
      eventDisplay: "ChronologyOnly",
    },
  ],
  relationships: [
    causal("event-a", "impact-a"),
    causal("event-b", "impact-b"),
    causal("key-a", "event-a"),
    causal("key-b", "event-a"),
    causal("key-b", "event-b"),
    causal("root-a", "event-b"),
    causal("root-b", "key-b"),
  ],
  controls: [
    {
      id: "c1",
      kind: "Control",
      relationshipId: "key-a-event-a",
      upstreamNodeId: "key-a",
      downstreamNodeId: "event-a",
    },
    {
      id: "c2",
      kind: "Control",
      relationshipId: "key-b-event-b",
      upstreamNodeId: "key-b",
      downstreamNodeId: "event-b",
    },
    {
      id: "c3",
      kind: "Control",
      relationshipId: "root-a-event-b",
      upstreamNodeId: "root-a",
      downstreamNodeId: "event-b",
    },
  ],
  actions: [
    action("a1", "key-a"),
    action("a2", "key-b"),
    action("a3", "root-a"),
    action("a4", "root-b"),
  ],
  chronology: [
    { nodeId: "timeline-a", timestamp: "1912-04-14T23:40:00Z" },
    { nodeId: "timeline-b", timestamp: "1912-04-15T00:20:00Z" },
  ],
};

export const representativeLayoutCases = {
  mu566Like,
  sq600Like,
  vehicleLike,
  titanicLike,
};
