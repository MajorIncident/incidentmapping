import {
  CHAIN_NODE_HEIGHT,
  CHAIN_NODE_WIDTH,
  CONTROL_NODE_HEIGHT,
  CONTROL_NODE_WIDTH,
} from "./dimensions";
import {
  ACTION_GAP,
  CAUSAL_ROW_GAP,
  CHRONOLOGY_GUTTER,
  SIBLING_GAP,
  requiredControlBandForNextRank,
} from "./geometry/spacing";
import type {
  InvestigationLayoutInput,
  InvestigationLayoutOptions,
  CausalRelationship,
  LayoutNodeGeometry,
  LayoutResult,
  MeasuredDimensions,
  Point,
  Rectangle,
  RoutedRelationship,
} from "./layoutModel";
import { routeCausalRelationships } from "./routing/causalRouting";
import {
  placeActionStacks,
  routeActionRelationships,
} from "./routing/actionRouting";
import { centerAlignmentDelta, rectanglesOverlap } from "./geometry/alignment";
import { OBJECT_CLEARANCE } from "./geometry/spacing";

type PositionedSize = Readonly<{
  position: Point;
  width: number;
  height: number;
}>;

/** Layout-owned placement of an ephemeral Control projection. */
export const calculateControlPosition = (
  source: PositionedSize,
  target: PositionedSize,
  control: MeasuredDimensions,
): Point => ({
  // The downstream port is the stable relationship lane through a merge.
  x: target.position.x + target.width / 2 - control.width / 2,
  // Use the concrete interval produced by rank placement, including measured
  // source height and any rank-aware Control band.
  y:
    source.position.y +
    source.height +
    (target.position.y - source.position.y - source.height - control.height) /
      2,
});

/** Renderer-neutral edge splitting retained for thin UI adapters. */
export const splitEdgeAtControl = <
  T extends { id: string; source: string; target: string },
>(
  edge: T,
  controlId: string,
) => [
  {
    ...edge,
    id: `${edge.id}-${controlId}-upstream`,
    target: controlId,
    sourceHandle: "bottom",
    targetHandle: "top",
  },
  {
    ...edge,
    id: `${edge.id}-${controlId}-downstream`,
    source: controlId,
    sourceHandle: "bottom",
    targetHandle: "top",
  },
];

const size = (
  dimensions: MeasuredDimensions | undefined,
  fallback: MeasuredDimensions,
) => dimensions ?? fallback;
const boundsOf = (nodes: readonly LayoutNodeGeometry[]): Rectangle => {
  const left = Math.min(0, ...nodes.map((node) => node.rectangle.x));
  const top = Math.min(0, ...nodes.map((node) => node.rectangle.y));
  const right = Math.max(
    0,
    ...nodes.map((node) => node.rectangle.x + node.rectangle.width),
  );
  const bottom = Math.max(
    0,
    ...nodes.map((node) => node.rectangle.y + node.rectangle.height),
  );
  return { x: left, y: top, width: right - left, height: bottom - top };
};

/**
 * Creates a disposable graph: Controls become nodes, while branch and merge
 * junctions remain bends in route geometry. Nothing returned is a map entity.
 */
export const layoutInvestigation = (
  input: InvestigationLayoutInput,
  options: InvestigationLayoutOptions,
): LayoutResult => {
  const grid = options.gridSize ?? 8;
  const hGap = options.horizontalGap ?? SIBLING_GAP;
  const vGap = options.verticalGap ?? CAUSAL_ROW_GAP;
  const snap = (value: number) => Math.round(value / grid) * grid;
  const chronologyIds = new Set(
    input.nodes
      .filter((node) => node.eventDisplay === "ChronologyOnly")
      .map((node) => node.id),
  );
  const causalNodes = input.nodes
    .filter((node) => !chronologyIds.has(node.id))
    .sort(
      (a, b) =>
        (a.layoutHints?.order ?? a.position?.x ?? 0) -
          (b.layoutHints?.order ?? b.position?.x ?? 0) ||
        a.id.localeCompare(b.id),
    );
  const causal = input.relationships.filter(
    (edge): edge is CausalRelationship =>
      edge.kind === "Causal" &&
      !chronologyIds.has(edge.fromId) &&
      !chronologyIds.has(edge.toId),
  );
  // Rank is graph structure, never node classification or a claimed parent.
  const rank = new Map(causalNodes.map((node) => [node.id, 0]));
  const children = new Map<string, string[]>();
  const remaining = new Map(causalNodes.map((node) => [node.id, 0]));
  causal.forEach((edge) => {
    const next = children.get(edge.fromId) ?? [];
    if (!next.includes(edge.toId)) next.push(edge.toId);
    children.set(edge.fromId, next);
    remaining.set(edge.toId, (remaining.get(edge.toId) ?? 0) + 1);
  });
  const queue = causalNodes
    .filter((node) => remaining.get(node.id) === 0)
    .sort(
      (a, b) =>
        (a.layoutHints?.order ?? a.position?.x ?? 0) -
          (b.layoutHints?.order ?? b.position?.x ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .map((node) => node.id);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    for (const child of children.get(id) ?? []) {
      rank.set(child, Math.max(rank.get(child) ?? 0, (rank.get(id) ?? 0) + 1));
      const count = (remaining.get(child) ?? 1) - 1;
      remaining.set(child, count);
      if (count === 0) queue.push(child);
    }
  }
  const rankHeights = new Map<number, number>();
  causalNodes.forEach((node) => {
    const dimensions = size(node.dimensions, {
      width: CHAIN_NODE_WIDTH,
      height: CHAIN_NODE_HEIGHT,
    });
    const level = rank.get(node.id) ?? 0;
    rankHeights.set(
      level,
      Math.max(rankHeights.get(level) ?? 0, dimensions.height),
    );
  });
  const rankOrigins = new Map<number, number>();
  const controlHeightsByRank = new Map<number, number[]>();
  const controlByRelationship = new Map(
    (input.controls ?? []).map((control) => [control.relationshipId, control]),
  );
  causal.forEach((edge) => {
    const control = controlByRelationship.get(edge.id);
    if (!control) return;
    const targetRank = rank.get(edge.toId) ?? 0;
    controlHeightsByRank.set(targetRank, [
      ...(controlHeightsByRank.get(targetRank) ?? []),
      control.dimensions?.height ?? CONTROL_NODE_HEIGHT,
    ]);
  });
  let origin = 0;
  [...rankHeights.keys()]
    .sort((a, b) => a - b)
    .forEach((level) => {
      rankOrigins.set(level, origin);
      origin +=
        rankHeights.get(level)! +
        vGap +
        requiredControlBandForNextRank(
          controlHeightsByRank.get(level + 1) ?? [],
        );
    });
  const rankOrder = new Map<number, number>();
  const prior = new Map(
    (options.priorGeometry ?? []).map((geometry) => [geometry.id, geometry]),
  );
  const addedId =
    options.structuralChange?.kind === "AddNode"
      ? options.structuralChange.nodeId
      : undefined;
  const actionSources = new Set(
    (input.actions ?? []).map((action) => action.attachedToId),
  );
  const placementNodes = [...causalNodes].sort(
    (a, b) =>
      (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0) ||
      Number(actionSources.has(a.id)) - Number(actionSources.has(b.id)) ||
      a.id.localeCompare(b.id),
  );
  const geometries: LayoutNodeGeometry[] = placementNodes.map((node) => {
    const previous = prior.get(node.id);
    const dimensions =
      options.mode === "Incremental" && previous && node.id !== addedId
        ? {
            width: previous.rectangle.width,
            height: previous.rectangle.height,
          }
        : size(node.dimensions, {
            width: CHAIN_NODE_WIDTH,
            height: CHAIN_NODE_HEIGHT,
          });
    const level = rank.get(node.id) ?? 0;
    const order = rankOrder.get(level) ?? 0;
    rankOrder.set(level, order + 1);
    const preferred = node.layoutHints?.preferredPosition ?? node.position;
    const position = {
      x:
        options.mode === "Incremental" && previous && node.id !== addedId
          ? previous.rectangle.x
          : options.mode === "Incremental" && preferred
            ? preferred.x
            : order * (dimensions.width + hGap),
      y:
        options.mode === "Incremental" && previous && node.id !== addedId
          ? previous.rectangle.y
          : (rankOrigins.get(level) ?? 0),
    };
    return {
      id: node.id,
      role: "Semantic",
      rectangle: { x: snap(position.x), y: snap(position.y), ...dimensions },
    };
  });
  if (options.mode === "Incremental" && addedId) {
    const added = geometries.find((geometry) => geometry.id === addedId);
    if (added) {
      const change = options.structuralChange;
      const parent =
        change?.kind === "AddNode"
          ? prior.get(change.parentId ?? "")
          : undefined;
      const sibling =
        change?.kind === "AddNode"
          ? prior.get(change.siblingId ?? "")
          : undefined;
      const peers = geometries.filter(
        (geometry) =>
          geometry.id !== addedId &&
          Math.abs(geometry.rectangle.y - added.rectangle.y) < grid,
      );
      const anchor = sibling ?? parent;
      const candidates = anchor
        ? [
            anchor.rectangle.x + anchor.rectangle.width + hGap,
            anchor.rectangle.x - added.rectangle.width - hGap,
          ]
        : [added.rectangle.x];
      const clear = (x: number) =>
        peers.every(
          (peer) =>
            x + added.rectangle.width + hGap <= peer.rectangle.x ||
            x >= peer.rectangle.x + peer.rectangle.width + hGap,
        );
      const x =
        candidates.find(clear) ??
        Math.max(
          0,
          ...peers.map(
            (peer) => peer.rectangle.x + peer.rectangle.width + hGap,
          ),
        );
      (added.rectangle as { x: number; y: number }).x = snap(x);
      if (sibling) (added.rectangle as { y: number }).y = sibling.rectangle.y;
      else if (parent)
        (added.rectangle as { y: number }).y = snap(
          parent.rectangle.y +
            parent.rectangle.height +
            vGap +
            requiredControlBandForNextRank(
              controlHeightsByRank.get(rank.get(addedId) ?? 0) ?? [],
            ),
        );
    }
  }
  const byId = new Map(geometries.map((node) => [node.id, node]));

  // ArrangeMap and measured relayouts enforce the same one-to-one lane as the
  // React Flow hierarchy. Claim a deterministic forest, preserve merge lanes,
  // and move complete child subtrees only when the translation stays clear of
  // unrelated branches. Actions are projected afterwards from their shifted
  // owner, so they receive the same correction.
  if (options.mode === "ArrangeMap") {
    const claimedChildren = new Map<string, string[]>();
    const claimed = new Set<string>();
    const claim = (id: string) => {
      const owned: string[] = [];
      for (const child of children.get(id) ?? []) {
        if (claimed.has(child)) continue;
        claimed.add(child);
        owned.push(child);
        claim(child);
      }
      claimedChildren.set(id, owned);
    };
    queue.forEach((id) => {
      if (!claimed.has(id)) {
        claimed.add(id);
        claim(id);
      }
    });
    causalNodes.forEach((node) => {
      if (!claimed.has(node.id)) {
        claimed.add(node.id);
        claim(node.id);
      }
    });
    const descendants = (id: string): Set<string> => {
      const result = new Set([id]);
      (claimedChildren.get(id) ?? []).forEach((child) =>
        descendants(child).forEach((item) => result.add(item)),
      );
      return result;
    };
    for (const parentId of [...claimedChildren.keys()].reverse()) {
      const owned = claimedChildren.get(parentId) ?? [];
      if (owned.length !== 1) continue;
      const childId = owned[0];
      if (causal.filter((edge) => edge.toId === childId).length !== 1) continue;
      const parent = byId.get(parentId);
      const child = byId.get(childId);
      if (!parent || !child) continue;
      const delta = centerAlignmentDelta(parent.rectangle, child.rectangle);
      if (!delta) continue;
      const moving = descendants(childId);
      const safe = geometries
        .filter((geometry) => moving.has(geometry.id))
        .every((geometry) =>
          geometries
            .filter((other) => !moving.has(other.id))
            .every(
              (other) =>
                !rectanglesOverlap(
                  { ...geometry.rectangle, x: geometry.rectangle.x + delta },
                  other.rectangle,
                  OBJECT_CLEARANCE,
                ),
            ),
        );
      if (!safe) continue;
      geometries
        .filter((geometry) => moving.has(geometry.id))
        .forEach(
          (geometry) => ((geometry.rectangle as { x: number }).x += delta),
        );
    }
  }

  const controlsByRelationship = new Map(
    (input.controls ?? []).map((control) => [control.relationshipId, control]),
  );
  const controlsByLane = new Map<string, LayoutNodeGeometry[]>();
  for (const edge of causal) {
    const control = controlsByRelationship.get(edge.id);
    const from = byId.get(edge.fromId);
    const to = byId.get(edge.toId);
    if (!control || !from || !to) continue;
    const dimensions = size(control.dimensions, {
      width: CONTROL_NODE_WIDTH,
      height: CONTROL_NODE_HEIGHT,
    });
    const position = calculateControlPosition(
      { position: from.rectangle, ...from.rectangle },
      { position: to.rectangle, ...to.rectangle },
      dimensions,
    );
    const geometry: LayoutNodeGeometry = {
      id: control.id,
      role: "Control",
      controlId: control.id,
      relationshipId: edge.id,
      // Controls are centered from measured React Flow dimensions. Do not snap
      // their origin: doing so shifts the center away from the relationship
      // lane whenever a measured width or height is not grid-aligned.
      rectangle: { x: position.x, y: position.y, ...dimensions },
    };
    geometries.push(geometry);
    byId.set(control.id, geometry);
    const laneKey = `${rank.get(edge.toId) ?? 0}:${to.rectangle.x + to.rectangle.width / 2}`;
    controlsByLane.set(laneKey, [
      ...(controlsByLane.get(laneKey) ?? []),
      geometry,
    ]);
  }
  controlsByLane.forEach((members) => {
    members.sort((a, b) => a.relationshipId!.localeCompare(b.relationshipId!));
    const lane = members[0].rectangle.x + members[0].rectangle.width / 2;
    const width =
      members.reduce((sum, member) => sum + member.rectangle.width, 0) +
      ACTION_GAP * Math.max(0, members.length - 1);
    let left = lane - width / 2;
    members.forEach((member) => {
      (member.rectangle as { x: number }).x = snap(left);
      left += member.rectangle.width + ACTION_GAP;
    });
  });

  // Classify and group only persisted semantic relationships. Control geometry
  // is supplied as a waypoint projection on its owning relationship.
  const causalRouting = routeCausalRelationships(
    causal,
    geometries,
    geometries
      .filter((node) => node.role === "Control")
      .map((node) => ({
        relationshipId: node.relationshipId!,
        controlId: node.controlId!,
        rectangle: node.rectangle,
      })),
  );
  const causalBounds = boundsOf(
    geometries.filter((node) => node.role === "Semantic"),
  );

  const chronology = input.nodes
    .filter((node) => chronologyIds.has(node.id))
    .sort((a, b) => {
      const ai = input.chronology?.find((item) => item.nodeId === a.id);
      const bi = input.chronology?.find((item) => item.nodeId === b.id);
      return (
        (ai?.order ?? Date.parse(ai?.timestamp ?? "")) -
          (bi?.order ?? Date.parse(bi?.timestamp ?? "")) ||
        a.id.localeCompare(b.id)
      );
    });
  let chronologyY = causalBounds.y;
  chronology.forEach((node) => {
    const dimensions = size(node.dimensions, {
      width: CHAIN_NODE_WIDTH,
      height: CHAIN_NODE_HEIGHT,
    });
    const geometry: LayoutNodeGeometry = {
      id: node.id,
      role: "Semantic",
      rectangle: {
        x: snap(causalBounds.x + causalBounds.width + CHRONOLOGY_GUTTER),
        y: snap(chronologyY),
        ...dimensions,
      },
    };
    chronologyY += dimensions.height + vGap;
    geometries.push(geometry);
  });

  const actionGeometries = placeActionStacks(
    input.actions ?? [],
    geometries.filter((node) => node.role === "Semantic"),
    causalBounds,
    snap,
  );
  geometries.push(...actionGeometries);
  const controlledCausalRelationships = causalRouting.relationships.flatMap(
    (relationship): RoutedRelationship[] => {
      const control = controlsByRelationship.get(relationship.relationshipId);
      if (!control) return [relationship];
      const controlGeometry = byId.get(control.id)!;
      const centerX =
        controlGeometry.rectangle.x + controlGeometry.rectangle.width / 2;
      const topIndex = relationship.route.findIndex(
        (point) =>
          point.x === centerX && point.y === controlGeometry.rectangle.y,
      );
      const bottomIndex = relationship.route.findIndex(
        (point) =>
          point.x === centerX &&
          point.y ===
            controlGeometry.rectangle.y + controlGeometry.rectangle.height,
      );
      const projection = (
        id: string,
        fromId: string,
        toId: string,
        route: RoutedRelationship["route"],
      ): RoutedRelationship => ({
        ...relationship,
        id,
        fromId,
        toId,
        route,
      });
      // Keep the canonical semantic relationship in the public result. Layout
      // consumers use its stable id and semantic endpoints (for example when
      // relating a Control back to its owner). The additional routes are
      // ephemeral renderer projections for the two visible sides of a Control.
      return [
        relationship,
        projection(
          `${relationship.id}-${control.id}-upstream`,
          relationship.fromId,
          control.id,
          relationship.route.slice(
            0,
            topIndex + 1,
          ) as unknown as RoutedRelationship["route"],
        ),
        projection(
          `${relationship.id}-${control.id}-downstream`,
          control.id,
          relationship.toId,
          relationship.route.slice(
            bottomIndex,
          ) as unknown as RoutedRelationship["route"],
        ),
      ];
    },
  );
  const routed: RoutedRelationship[] = [
    ...controlledCausalRelationships,
    ...routeActionRelationships(
      input.relationships.filter((item) => item.kind === "Action"),
      geometries,
    ),
  ];
  return {
    nodes: geometries,
    relationships: routed,
    sharedSegments: causalRouting.sharedSegments,
    bounds: boundsOf(geometries),
    causalBounds,
  };
};
