import {
  ACTION_GAP,
  ACTION_GUTTER,
  EDGE_STUB,
  OBJECT_CLEARANCE,
} from "../geometry/spacing";
import type {
  Action,
  ActionRelationship,
  LayoutNodeGeometry,
  Rectangle,
  RoutedRelationship,
} from "../layoutModel";
import { inflateRectangle, routeOrthogonally } from "./geometry";

const overlapsVertically = (a: Rectangle, b: Rectangle) =>
  a.y < b.y + b.height + ACTION_GAP && b.y < a.y + a.height + ACTION_GAP;

/**
 * Places Actions only after the causal layout is fixed. Stacks may move farther
 * into the gutter to resolve one another, but never resize or move causal nodes.
 */
export const placeActionStacks = (
  actions: readonly Action[],
  semanticNodes: readonly LayoutNodeGeometry[],
  causalBounds: Rectangle,
  snap: (value: number) => number = (value) => value,
): LayoutNodeGeometry[] => {
  const sources = new Map(semanticNodes.map((node) => [node.id, node]));
  const bySource = new Map<string, Action[]>();
  actions.forEach((action) =>
    bySource.set(action.attachedToId, [
      ...(bySource.get(action.attachedToId) ?? []),
      action,
    ]),
  );
  const placed: LayoutNodeGeometry[] = [];
  [...bySource]
    .sort(([a], [b]) => {
      const ar = sources.get(a)?.rectangle;
      const br = sources.get(b)?.rectangle;
      return (ar?.y ?? 0) - (br?.y ?? 0) || a.localeCompare(b);
    })
    .forEach(([sourceId, stack]) => {
      const source = sources.get(sourceId);
      if (!source) return;
      stack.sort(
        (a, b) =>
          (a.position?.y ?? source.rectangle.y) -
            (b.position?.y ?? source.rectangle.y) || a.id.localeCompare(b.id),
      );
      let y = source.rectangle.y;
      let x = Math.max(
        source.rectangle.x + source.rectangle.width + ACTION_GUTTER,
        causalBounds.x + causalBounds.width + ACTION_GUTTER,
      );
      const rectangles = stack.map((action) => {
        const dimensions = action.dimensions ?? { width: 240, height: 112 };
        const rectangle = { x: snap(x), y: snap(y), ...dimensions };
        y += dimensions.height + ACTION_GAP;
        return { action, rectangle };
      });
      while (
        rectangles.some(({ rectangle }) =>
          placed.some((other) =>
            overlapsVertically(rectangle, other.rectangle),
          ),
        )
      ) {
        const width = Math.max(
          ...rectangles.map((item) => item.rectangle.width),
        );
        x += width + ACTION_GAP;
        rectangles.forEach((item) =>
          Object.assign(item.rectangle, { x: snap(x) }),
        );
      }
      rectangles.forEach(({ action, rectangle }) =>
        placed.push({ id: action.id, role: "Action", rectangle }),
      );
    });
  return placed;
};

/** Routes from the source's right handle, keeping Action ink in the gutter. */
export const routeActionRelationships = (
  relationships: readonly ActionRelationship[],
  nodes: readonly LayoutNodeGeometry[],
): RoutedRelationship[] => {
  const byId = new Map(nodes.map((node) => [node.id, node.rectangle]));
  return relationships.flatMap((edge): RoutedRelationship[] => {
    const source = byId.get(edge.fromId);
    const target = byId.get(edge.toId);
    if (!source || !target) return [];
    const from = {
      x: source.x + source.width,
      y: source.y + source.height / 2,
    };
    const to = { x: target.x, y: target.y + target.height / 2 };
    const stubX = Math.min(to.x, from.x + EDGE_STUB);
    const startStub = { x: stubX, y: from.y };
    const endStub = { x: Math.max(stubX, to.x - EDGE_STUB), y: to.y };
    const obstacles = nodes
      .filter((node) => node.id !== edge.fromId && node.id !== edge.toId)
      .map((node) => inflateRectangle(node.rectangle, OBJECT_CLEARANCE));
    const middle = routeOrthogonally(startStub, endStub, obstacles);
    return [
      {
        id: edge.id,
        relationshipId: edge.id,
        kind: "Action",
        fromId: edge.fromId,
        toId: edge.toId,
        role: "Direct",
        route: [from, ...middle, to],
      },
    ];
  });
};
