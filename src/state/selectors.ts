import type { Node } from "reactflow";
import type { ChainNodeData } from "./useAppStore";
import type { ContextItem, EvidenceItem } from "../features/maps/schema";

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

export const selectChronologicalEvents = (nodes: Node<ChainNodeData>[]) =>
  nodes
    .filter((node) => node.data.nodeType === "Event" && node.data.timestamp)
    .slice()
    .sort((a, b) =>
      (a.data.timestamp as string).localeCompare(b.data.timestamp as string),
    );
