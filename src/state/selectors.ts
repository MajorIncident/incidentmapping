import type { Node } from "reactflow";
import type { ChainNodeData } from "./useAppStore";

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
