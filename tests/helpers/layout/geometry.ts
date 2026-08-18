import type { Node } from "reactflow";
import {
  CHAIN_NODE_HEIGHT,
  CHAIN_NODE_WIDTH,
  CONTROL_NODE_HEIGHT,
  CONTROL_NODE_WIDTH,
} from "../../../src/features/layout/dimensions";
import {
  CAUSAL_ROW_GAP,
  CONTROL_BAND_HEIGHT,
} from "../../../src/features/layout/geometry/spacing";
import type {
  LayoutResult,
  Point,
  Rectangle,
} from "../../../src/features/layout/layoutModel";

export type Segment = Readonly<{ from: Point; to: Point }>;

export const rectanglesIntersect = (left: Rectangle, right: Rectangle) =>
  left.x < right.x + right.width &&
  left.x + left.width > right.x &&
  left.y < right.y + right.height &&
  left.y + left.height > right.y;

export const segmentIntersectsRectangle = (
  { from, to }: Segment,
  rectangle: Rectangle,
) =>
  from.x === to.x
    ? from.x > rectangle.x &&
      from.x < rectangle.x + rectangle.width &&
      Math.max(from.y, to.y) > rectangle.y &&
      Math.min(from.y, to.y) < rectangle.y + rectangle.height
    : from.y === to.y &&
      from.y > rectangle.y &&
      from.y < rectangle.y + rectangle.height &&
      Math.max(from.x, to.x) > rectangle.x &&
      Math.min(from.x, to.x) < rectangle.x + rectangle.width;

/** Returns the real ordered route segments emitted by LayoutResult. */
export const routeSegments = (points: readonly Point[]): Segment[] =>
  points.slice(1).map((to, index) => ({ from: points[index], to }));

export const routeCrossesRectangle = (
  points: readonly Point[],
  rectangle: Rectangle,
) =>
  routeSegments(points).some((segment) =>
    segmentIntersectsRectangle(segment, rectangle),
  );

export const geometryById = (result: LayoutResult) =>
  new Map(result.nodes.map((node) => [node.id, node]));

export const nodeRectangle = (node: Node): Rectangle => ({
  ...node.position,
  width: node.width ?? CHAIN_NODE_WIDTH,
  height: node.height ?? CHAIN_NODE_HEIGHT,
});

export const legacyControlRectangle = (
  _upstream: Node,
  downstream: Node,
  width = CONTROL_NODE_WIDTH,
  height = CONTROL_NODE_HEIGHT,
): Rectangle => ({
  x:
    downstream.position.x +
    (downstream.width ?? CHAIN_NODE_WIDTH) / 2 -
    width / 2,
  y:
    downstream.position.y -
    (CAUSAL_ROW_GAP + CONTROL_BAND_HEIGHT) / 2 -
    height / 2,
  width,
  height,
});

export const hasClearance = (left: Rectangle, right: Rectangle, margin = 32) =>
  left.x + left.width + margin <= right.x ||
  right.x + right.width + margin <= left.x ||
  left.y + left.height + margin <= right.y ||
  right.y + right.height + margin <= left.y;
