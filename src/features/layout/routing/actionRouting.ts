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

const MAX_ACTION_GUTTER_COLUMNS = 64;

/** Full 2D collision is essential: gutter resolution changes x, not y. */
export const rectanglesOverlap = (
  a: Rectangle,
  b: Rectangle,
  clearance = ACTION_GAP,
) =>
  a.x < b.x + b.width + clearance &&
  a.x + a.width + clearance > b.x &&
  a.y < b.y + b.height + clearance &&
  a.y + a.height + clearance > b.y;

/**
 * Places Actions only after the causal layout is fixed. Stacks may move farther
 * into the gutter to resolve one another, but never resize or move causal nodes.
 */
export const placeActionStacks = (
  actions: readonly Action[],
  causalObjects: readonly LayoutNodeGeometry[],
  _causalBounds: Rectangle,
  snap: (value: number) => number = (value) => value,
  preservePrior = false,
  preferredYBySource: ReadonlyMap<string, number> = new Map(),
): LayoutNodeGeometry[] => {
  const sources = new Map(causalObjects.map((node) => [node.id, node]));
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
      const stackHeight = stack.reduce(
        (height, action, index) =>
          height +
          (action.dimensions?.height ?? 112) +
          (index === 0 ? 0 : ACTION_GAP),
        0,
      );
      let y =
        preferredYBySource.get(sourceId) ??
        source.rectangle.y + source.rectangle.height / 2 - stackHeight / 2;
      const preferredX =
        source.rectangle.x + source.rectangle.width + ACTION_GUTTER;
      let x = preferredX;
      const rectangles = stack.map((action) => {
        const dimensions = action.dimensions ?? { width: 240, height: 112 };
        const rectangle = { x, y, ...dimensions };
        y += dimensions.height + ACTION_GAP;
        return { action, rectangle };
      });
      const obstacles = [...causalObjects, ...placed];
      const collides = () =>
        rectangles.some(({ rectangle }) =>
          obstacles.some((other) =>
            rectanglesOverlap(
              { ...rectangle, x: snap(rectangle.x), y: snap(rectangle.y) },
              other.rectangle,
            ),
          ),
        );

      // Incremental projection respects a valid, reasonably local saved/user
      // sidecar. A render pass must not contradict Arrange Map geometry.
      const priorX = stack[0]?.position?.x;
      const priorY = stack[0]?.position?.y;
      if (
        preservePrior &&
        priorX !== undefined &&
        priorY !== undefined &&
        priorX >= source.rectangle.x + source.rectangle.width &&
        priorX - preferredX <=
          2 *
            (Math.max(...rectangles.map((item) => item.rectangle.width)) +
              ACTION_GAP)
      ) {
        const deltaY = priorY - rectangles[0].rectangle.y;
        rectangles.forEach((item) => {
          item.rectangle.x = priorX;
          item.rectangle.y += deltaY;
        });
        if (collides()) {
          rectangles.forEach((item) => {
            item.rectangle.x = preferredX;
            item.rectangle.y -= deltaY;
          });
        }
      }

      let gutterColumn = 0;
      while (gutterColumn < MAX_ACTION_GUTTER_COLUMNS && collides()) {
        // Advance only beyond obstacles which actually intersect this stack's
        // vertical band. This produces the nearest clear local column.
        const blockers = obstacles.filter((other) =>
          rectangles.some(({ rectangle }) =>
            rectanglesOverlap(rectangle, other.rectangle),
          ),
        );
        x = Math.max(
          x + ACTION_GAP,
          ...blockers.map(
            (other) => other.rectangle.x + other.rectangle.width + ACTION_GAP,
          ),
        );
        rectangles.forEach((item) => Object.assign(item.rectangle, { x }));
        gutterColumn++;
      }
      if (gutterColumn === MAX_ACTION_GUTTER_COLUMNS) {
        // Deterministic, bounded degradation. This should only be reachable for
        // pathological maps; interactivity is more important than optimal ink.
        const widest = Math.max(
          ...rectangles.map(({ rectangle }) => rectangle.width),
        );
        x = preferredX + (placed.length + 1) * (widest + ACTION_GAP);
        rectangles.forEach((item) => Object.assign(item.rectangle, { x }));
        if (import.meta.env.DEV)
          console.warn(
            "Action gutter safety limit reached; using fallback column",
          );
      }
      rectangles.forEach(({ action, rectangle }) =>
        placed.push({
          id: action.id,
          role: "Action",
          rectangle: {
            ...rectangle,
            x: snap(rectangle.x),
            y: snap(rectangle.y),
          },
        }),
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
