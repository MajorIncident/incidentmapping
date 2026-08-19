import type { Edge, Node, XYPosition } from "reactflow";
import {
  CHAIN_NODE_DETAILS_HEIGHT,
  CHAIN_NODE_HEIGHT,
  CHAIN_NODE_WIDTH,
} from "./dimensions";
import {
  ACTION_GAP,
  ACTION_GUTTER,
  CAUSAL_ROW_GAP,
  SIBLING_GAP,
} from "./geometry/spacing";

export const GRID_SIZE = 8;
export const HORIZONTAL_GAP = SIBLING_GAP;
export const VERTICAL_GAP = CAUSAL_ROW_GAP;
export const ACTION_HORIZONTAL_GAP = ACTION_GUTTER;
export const ACTION_VERTICAL_GAP = ACTION_GAP;
export type CanvasDetail = "Compact" | "Expanded";
export const snapPosition = ({ x, y }: XYPosition): XYPosition => ({
  x: Math.round(x / GRID_SIZE) * GRID_SIZE,
  y: Math.round(y / GRID_SIZE) * GRID_SIZE,
});
export const getNodeSize = <Data>(
  node: Node<Data>,
  detail: CanvasDetail | boolean,
) => ({
  width: node.width ?? CHAIN_NODE_WIDTH,
  height:
    node.height ??
    (detail === "Expanded" || detail === true
      ? CHAIN_NODE_HEIGHT + CHAIN_NODE_DETAILS_HEIGHT
      : CHAIN_NODE_HEIGHT),
});
export const buildChildrenByParent = (
  edges: readonly Edge[],
): Map<string, string[]> => {
  const result = new Map<string, string[]>();
  edges.forEach((edge) => {
    const children = result.get(edge.source) ?? [];
    if (!children.includes(edge.target)) children.push(edge.target);
    result.set(edge.source, children);
  });
  return result;
};
