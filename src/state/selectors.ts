import type { Node } from "reactflow";
import type { ChainNodeData } from "./useAppStore";
import type { ContextItem, EvidenceItem } from "../features/maps/schema";
import type { EventPhase } from "../features/maps/schema";

const causalNodeTypes = new Set<ChainNodeData["nodeType"]>([
  "Impact",
  "Event",
  "Factor",
]);

/** Whether the current selection can participate in the causal chain. */
export const canAddBelowSelection = (
  selectionId: string | null,
  nodes: Node<ChainNodeData>[],
): boolean => {
  if (!selectionId) return false;
  const selectedNode = nodes.find((node) => node.id === selectionId);
  return Boolean(
    selectedNode?.data.nodeType &&
      causalNodeTypes.has(selectedNode.data.nodeType),
  );
};

export const resolveEvidence = (ids: string[], registry: EvidenceItem[]) => {
  const byId = new Map(registry.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item ? [{ ...item }] : [];
  });
};

export const selectEvidenceLinkCounts = (
  registry: EvidenceItem[],
  nodes: Node<ChainNodeData>[],
  controls: Array<{ evidenceIds: string[] }>,
) =>
  Object.fromEntries(
    registry.map((item) => [
      item.id,
      nodes.filter((node) => (node.data.evidenceIds ?? []).includes(item.id))
        .length +
        controls.filter((control) => control.evidenceIds.includes(item.id))
          .length,
    ]),
  );

export const selectPinnedContext = (items: ContextItem[]) =>
  items.filter((item) => item.showOnCard).map((item) => ({ ...item }));

export const chronologyPhaseOrder: EventPhase[] = [
  "Precursor",
  "Incident",
  "Detection",
  "Response",
  "Recovery",
];

export type ChronologyGroup = {
  phase: EventPhase | "Unphased" | "Untimed Events";
  events: Node<ChainNodeData>[];
};

const chronologyTieBreaker = (a: Node<ChainNodeData>, b: Node<ChainNodeData>) =>
  (a.data.referenceId ?? "").localeCompare(b.data.referenceId ?? "") ||
  a.data.title.localeCompare(b.data.title) ||
  a.id.localeCompare(b.id);

/**
 * Builds the read-only incident chronology. Valid timestamps are ordered by
 * instant, then reference/title; Events without a parseable timestamp are
 * deliberately retained in a final “Untimed Events” group.
 */
export const selectChronologyGroups = (
  nodes: Node<ChainNodeData>[],
): ChronologyGroup[] => {
  const events = nodes.filter((node) => node.data.nodeType === "Event");
  const timed = events
    .filter((node) => Number.isFinite(Date.parse(node.data.timestamp ?? "")))
    .slice()
    .sort((a, b) => {
      const time =
        Date.parse(a.data.timestamp ?? "") - Date.parse(b.data.timestamp ?? "");
      return time || chronologyTieBreaker(a, b);
    });
  const phases: Array<EventPhase | "Unphased"> = [
    ...chronologyPhaseOrder,
    "Unphased",
  ];
  const groups: ChronologyGroup[] = phases.flatMap((phase) => {
    const matching = timed.filter(
      (node) => (node.data.eventPhase ?? "Unphased") === phase,
    );
    return matching.length ? [{ phase, events: matching }] : [];
  });
  const untimed = events
    .filter((node) => !Number.isFinite(Date.parse(node.data.timestamp ?? "")))
    .slice()
    .sort(chronologyTieBreaker);
  if (untimed.length) groups.push({ phase: "Untimed Events", events: untimed });
  return groups;
};

/** @deprecated Prefer selectChronologyGroups so untimed Events are retained. */
export const selectChronologicalEvents = (nodes: Node<ChainNodeData>[]) =>
  selectChronologyGroups(nodes)
    .filter((group) => group.phase !== "Untimed Events")
    .flatMap((group) => group.events);
