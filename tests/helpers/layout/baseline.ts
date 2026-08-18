import type { Edge, Node, XYPosition } from "reactflow";
import {
  CONTROL_NODE_HEIGHT,
  CONTROL_NODE_WIDTH,
} from "../../../src/features/layout/dimensions";
import {
  getNodeSize,
  layoutHierarchy,
  type HierarchyLayoutOptions,
} from "../../../src/features/layout/hierarchy";
import type { LayoutTopology } from "./topology";
import {
  CAUSAL_ROW_GAP,
  CONTROL_BAND_HEIGHT,
} from "../../../src/features/layout/geometry/spacing";

export type RoutedEdge = Edge & { points?: readonly XYPosition[] };
export type LayoutOutput = { nodes: Node[]; edges: RoutedEdge[] };
export type LayoutAdapter = (topology: LayoutTopology) => LayoutOutput;
export type LayoutBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type PlacementMetric = {
  count: number;
  placed: number;
  coordinates: Record<string, XYPosition>;
};
export type LayoutBaseline = {
  nodeCount: number;
  edgeCount: number;
  bounds: LayoutBounds;
  crossings: number;
  bends: number;
  controls: PlacementMetric;
  actions: PlacementMetric;
  deterministic: boolean;
  fingerprint: string;
};

const pointsFor = (edge: RoutedEdge, byId: Map<string, Node>) => {
  if (edge.points?.length) return [...edge.points];
  const source = byId.get(edge.source);
  const target = byId.get(edge.target);
  if (!source || !target) return [];
  const sourceSize = getNodeSize(source, false);
  const targetSize = getNodeSize(target, false);
  return [
    {
      x: source.position.x + sourceSize.width / 2,
      y: source.position.y + sourceSize.height / 2,
    },
    {
      x: target.position.x + targetSize.width / 2,
      y: target.position.y + targetSize.height / 2,
    },
  ];
};

const orientation = (a: XYPosition, b: XYPosition, c: XYPosition) =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
const segmentsCross = (
  a: XYPosition,
  b: XYPosition,
  c: XYPosition,
  d: XYPosition,
) =>
  orientation(a, b, c) * orientation(a, b, d) < 0 &&
  orientation(c, d, a) * orientation(c, d, b) < 0;

const serialize = (output: LayoutOutput) =>
  JSON.stringify({
    nodes: output.nodes.map(({ id, position }) => ({ id, position })),
    edges: output.edges.map(({ id, source, target, points }) => ({
      id,
      source,
      target,
      points,
    })),
  });

const measure = (
  topology: LayoutTopology,
  output: LayoutOutput,
): Omit<LayoutBaseline, "deterministic" | "fingerprint"> => {
  const byId = new Map(output.nodes.map((node) => [node.id, node]));
  const rectangles = output.nodes.map((node) => {
    const size = getNodeSize(node, false);
    return { ...node.position, ...size };
  });
  const minX = rectangles.length
    ? Math.min(...rectangles.map((item) => item.x))
    : 0;
  const minY = rectangles.length
    ? Math.min(...rectangles.map((item) => item.y))
    : 0;
  const maxX = rectangles.length
    ? Math.max(...rectangles.map((item) => item.x + item.width))
    : 0;
  const maxY = rectangles.length
    ? Math.max(...rectangles.map((item) => item.y + item.height))
    : 0;
  const routes = output.edges.map((edge) => ({
    edge,
    points: pointsFor(edge, byId),
  }));
  let crossings = 0;
  routes.forEach((left, index) =>
    routes.slice(index + 1).forEach((right) => {
      if (
        [left.edge.source, left.edge.target].some(
          (id) => id === right.edge.source || id === right.edge.target,
        )
      )
        return;
      left.points.slice(0, -1).forEach((start, segment) =>
        right.points.slice(0, -1).forEach((otherStart, otherSegment) => {
          if (
            segmentsCross(
              start,
              left.points[segment + 1],
              otherStart,
              right.points[otherSegment + 1],
            )
          )
            crossings += 1;
        }),
      );
    }),
  );
  const controlCoordinates: Record<string, XYPosition> = {};
  let placedControls = 0;
  topology.controls.forEach((control) => {
    const upstream = byId.get(control.upstreamNodeId);
    const downstream = byId.get(control.downstreamNodeId);
    if (!upstream || !downstream) return;
    const downstreamSize = getNodeSize(downstream, false);
    controlCoordinates[control.id] = {
      x:
        downstream.position.x +
        downstreamSize.width / 2 -
        CONTROL_NODE_WIDTH / 2,
      y:
        downstream.position.y -
        (CAUSAL_ROW_GAP + CONTROL_BAND_HEIGHT) / 2 -
        CONTROL_NODE_HEIGHT / 2,
    };
    placedControls += 1;
  });
  const actionCoordinates: Record<string, XYPosition> = {};
  let placedActions = 0;
  topology.edges
    .filter((edge) => edge.data?.kind === "ActionEdge")
    .forEach((edge) => {
      const source = byId.get(edge.source);
      const action = byId.get(edge.target);
      if (!source || !action) return;
      actionCoordinates[action.id] = { ...action.position };
      if (
        action.position.x >=
        source.position.x + getNodeSize(source, false).width
      )
        placedActions += 1;
    });
  return {
    nodeCount: output.nodes.length,
    edgeCount: output.edges.length,
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    crossings,
    bends: routes.reduce(
      (count, route) => count + Math.max(0, route.points.length - 2),
      0,
    ),
    controls: {
      count: topology.controls.length,
      placed: placedControls,
      coordinates: controlCoordinates,
    },
    actions: {
      count: Object.keys(actionCoordinates).length,
      placed: placedActions,
      coordinates: actionCoordinates,
    },
  };
};

/** Runs an adapter twice and captures static, browser-independent migration metrics. */
export const evaluateLayout = (
  topology: LayoutTopology,
  adapter: LayoutAdapter,
): LayoutBaseline => {
  const first = adapter(topology);
  const second = adapter(topology);
  const fingerprint = serialize(first);
  return {
    ...measure(topology, first),
    deterministic: fingerprint === serialize(second),
    fingerprint,
  };
};

export const hierarchyAdapter =
  (options: boolean | HierarchyLayoutOptions = false): LayoutAdapter =>
  (topology) => ({
    nodes: layoutHierarchy(topology.nodes, topology.edges, {
      ...(typeof options === "boolean"
        ? {
            canvasDetail: options
              ? ("Expanded" as const)
              : ("Compact" as const),
          }
        : options),
      barrierEdges: topology.controls,
    }),
    edges: topology.edges.map((edge) => ({ ...edge })),
  });

export type BaselineComparison = {
  existing: LayoutBaseline;
  candidate: LayoutBaseline;
};
/** Evaluates the old hierarchy and a migration adapter against identical input. */
export const compareLayoutAdapters = (
  topology: LayoutTopology,
  candidate: LayoutAdapter,
  existing: LayoutAdapter = hierarchyAdapter(),
): BaselineComparison => ({
  existing: evaluateLayout(topology, existing),
  candidate: evaluateLayout(topology, candidate),
});
