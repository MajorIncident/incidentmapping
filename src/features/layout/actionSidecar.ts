import {
  ACTION_DISTANCE_WEIGHT,
  ACTION_GAP,
  ACTION_GUTTER,
  ACTION_ROUTE_WEIGHT,
  ACTION_VERTICAL_SEARCH_STEP,
  BRANCH_MOVEMENT_WEIGHT,
  CARD_COLLISION_CLEARANCE,
  CAUSAL_WIDTH_WEIGHT,
  MAX_ACTION_INDUCED_BRANCH_SHIFT,
  MAX_ACTION_VERTICAL_OFFSET,
} from "./geometry/spacing";
import type {
  Action,
  CausalRelationship,
  LayoutNodeGeometry,
  Rectangle,
} from "./layoutModel";
import { rectanglesOverlap } from "./routing/actionRouting";

export type ActionSidecarEnvelope = Readonly<{
  sourceId: string;
  preferredRectangle: Rectangle;
  actionIds: readonly string[];
  requiredWidth: number;
  requiredHeight: number;
}>;

export type ActionSidecarNegotiation = Readonly<{
  preferredY: ReadonlyMap<string, number>;
  movedNodeIds: readonly string[];
  branchMovement: number;
  causalWidthIncrease: number;
}>;

/** Derives the complete local stack requirement; Actions remain outside the DAG. */
export const deriveActionSidecarEnvelopes = (
  actions: readonly Action[],
  semanticNodes: readonly LayoutNodeGeometry[],
): ActionSidecarEnvelope[] => {
  const sources = new Map(semanticNodes.map((node) => [node.id, node]));
  const groups = new Map<string, Action[]>();
  actions.forEach((action) =>
    groups.set(action.attachedToId, [
      ...(groups.get(action.attachedToId) ?? []),
      action,
    ]),
  );
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([sourceId, stack]) => {
      const source = sources.get(sourceId)?.rectangle;
      if (!source) return [];
      const ordered = [...stack].sort((a, b) => a.id.localeCompare(b.id));
      const requiredWidth = Math.max(
        ...ordered.map((action) => action.dimensions?.width ?? 240),
      );
      const requiredHeight =
        ordered.reduce(
          (sum, action) => sum + (action.dimensions?.height ?? 112),
          0,
        ) +
        ACTION_GAP * Math.max(0, ordered.length - 1);
      return [
        {
          sourceId,
          actionIds: ordered.map((action) => action.id),
          requiredWidth,
          requiredHeight,
          preferredRectangle: {
            x: source.x + source.width + ACTION_GUTTER,
            y: source.y + source.height / 2 - requiredHeight / 2,
            width: requiredWidth,
            height: requiredHeight,
          },
        },
      ];
    });
};

/**
 * Returns the coherent portion rooted at `rootId`. A descendant joins only
 * after every causal predecessor is already in the moving set, so traversal
 * stops naturally at DAG merge regions.
 */
export const getExclusiveBranchMembers = (
  rootId: string,
  relationships: readonly CausalRelationship[],
): Set<string> => {
  const incoming = new Map<string, Set<string>>();
  const children = new Map<string, string[]>();
  relationships.forEach((edge) => {
    incoming.set(
      edge.toId,
      new Set([...(incoming.get(edge.toId) ?? []), edge.fromId]),
    );
    children.set(edge.fromId, [
      ...(children.get(edge.fromId) ?? []),
      edge.toId,
    ]);
  });
  const result = new Set([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of [...(children.get(id) ?? [])].sort()) {
      if (result.has(child)) continue;
      const parents = incoming.get(child) ?? new Set<string>();
      if ([...parents].every((parent) => result.has(parent))) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return result;
};

const offsets = () => {
  const result = [0];
  for (
    let amount = ACTION_VERTICAL_SEARCH_STEP;
    amount <= MAX_ACTION_VERTICAL_OFFSET;
    amount += ACTION_VERTICAL_SEARCH_STEP
  )
    result.push(-amount, amount);
  return result;
};

/** Limited deterministic candidate repair: vertical pocket, branch shift, fallback. */
export const negotiateActionSidecars = (
  actions: readonly Action[],
  semanticNodes: readonly LayoutNodeGeometry[],
  relationships: readonly CausalRelationship[],
  snap: (value: number) => number,
  sourceFilter?: ReadonlySet<string>,
): ActionSidecarNegotiation => {
  const originalLeft = Math.min(
    ...semanticNodes.map((node) => node.rectangle.x),
  );
  const originalRight = Math.max(
    ...semanticNodes.map((node) => node.rectangle.x + node.rectangle.width),
  );
  const preferredY = new Map<string, number>();
  const moved = new Set<string>();
  let branchMovement = 0;
  for (const envelope of deriveActionSidecarEnvelopes(actions, semanticNodes)) {
    if (sourceFilter && !sourceFilter.has(envelope.sourceId)) continue;
    const source = semanticNodes.find((node) => node.id === envelope.sourceId);
    if (!source) continue;
    const obstacles = () =>
      semanticNodes.filter((node) => node.id !== envelope.sourceId);
    const candidateAt = (dy: number): Rectangle => ({
      ...envelope.preferredRectangle,
      y: snap(envelope.preferredRectangle.y + dy),
    });
    const clear = (rectangle: Rectangle) =>
      obstacles().every(
        (node) => !rectanglesOverlap(rectangle, node.rectangle, ACTION_GAP),
      );
    const vertical = offsets().map(candidateAt).find(clear);
    if (vertical) {
      preferredY.set(envelope.sourceId, vertical.y);
      continue;
    }

    const pocket = candidateAt(0);
    const blockers = obstacles()
      .filter((node) => rectanglesOverlap(pocket, node.rectangle, ACTION_GAP))
      .filter((node) => node.rectangle.x >= source.rectangle.x)
      .sort(
        (a, b) => a.rectangle.x - b.rectangle.x || a.id.localeCompare(b.id),
      );
    if (!blockers.length) continue;
    const root = blockers[0];
    const members = getExclusiveBranchMembers(root.id, relationships);
    const moving = semanticNodes.filter((node) => members.has(node.id));
    const required = snap(
      pocket.x + pocket.width + CARD_COLLISION_CLEARANCE - root.rectangle.x,
    );
    if (required <= 0 || required > MAX_ACTION_INDUCED_BRANCH_SHIFT) continue;
    const shifted = moving.map((node) => ({
      ...node.rectangle,
      x: snap(node.rectangle.x + required),
    }));
    const safe = shifted.every((rectangle) =>
      semanticNodes
        .filter((node) => !members.has(node.id))
        .every(
          (node) =>
            !rectanglesOverlap(
              rectangle,
              node.rectangle,
              CARD_COLLISION_CLEARANCE,
            ),
        ),
    );
    if (!safe) continue;
    const alternateDistance = required + ACTION_GAP;
    const movement = required * moving.length;
    const repairCost =
      CAUSAL_WIDTH_WEIGHT * required + BRANCH_MOVEMENT_WEIGHT * movement;
    const fallbackCost =
      ACTION_DISTANCE_WEIGHT * alternateDistance +
      ACTION_ROUTE_WEIGHT * alternateDistance;
    if (repairCost >= fallbackCost) continue;
    moving.forEach((node) => {
      (node.rectangle as { x: number }).x = snap(node.rectangle.x + required);
      moved.add(node.id);
    });
    branchMovement += movement;
    preferredY.set(envelope.sourceId, pocket.y);
  }
  const newLeft = Math.min(...semanticNodes.map((node) => node.rectangle.x));
  const newRight = Math.max(
    ...semanticNodes.map((node) => node.rectangle.x + node.rectangle.width),
  );
  return {
    preferredY,
    movedNodeIds: [...moved].sort(),
    branchMovement,
    causalWidthIncrease: newRight - newLeft - (originalRight - originalLeft),
  };
};
