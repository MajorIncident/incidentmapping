import { EDGE_STUB, OBJECT_CLEARANCE } from "../geometry/spacing";
import type {
  CausalRelationship,
  CausalRouteRole,
  LayoutNodeGeometry,
  OrthogonalRoute,
  RoutedRelationship,
  SharedRouteSegment,
} from "../layoutModel";
import {
  createBranchRail,
  createMergeRail,
  type RoutingEndpoint,
} from "./branchRouting";
import {
  inflateRectangle,
  routeOrthogonally,
  simplifyOrthogonalRoute,
} from "./geometry";

export const classifyCausalRelationship = (
  sourceOutDegree: number,
  targetInDegree: number,
): CausalRouteRole =>
  sourceOutDegree > 1 && targetInDegree > 1
    ? "BranchAndMerge"
    : sourceOutDegree > 1
      ? "Branch"
      : targetInDegree > 1
        ? "Merge"
        : "Direct";

export const classifyCausalRelationships = (
  relationships: readonly CausalRelationship[],
) => {
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  relationships.forEach((edge) => {
    outgoing.set(edge.fromId, (outgoing.get(edge.fromId) ?? 0) + 1);
    incoming.set(edge.toId, (incoming.get(edge.toId) ?? 0) + 1);
  });
  return new Map(
    relationships.map((edge) => [
      edge.id,
      classifyCausalRelationship(
        outgoing.get(edge.fromId) ?? 0,
        incoming.get(edge.toId) ?? 0,
      ),
    ]),
  );
};

export type CausalRoutingResult = Readonly<{
  relationships: readonly RoutedRelationship[];
  sharedSegments: readonly SharedRouteSegment[];
}>;

/** Routes the semantic graph. Control state is intentionally absent from this API. */
export const routeCausalRelationships = (
  relationships: readonly CausalRelationship[],
  nodes: readonly LayoutNodeGeometry[],
): CausalRoutingResult => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roles = classifyCausalRelationships(relationships);
  const endpoints = relationships.flatMap((edge): RoutingEndpoint[] => {
    const source = byId.get(edge.fromId)?.rectangle;
    const target = byId.get(edge.toId)?.rectangle;
    return source && target
      ? [
          {
            relationshipId: edge.id,
            sourceId: edge.fromId,
            targetId: edge.toId,
            source: {
              x: source.x + source.width / 2,
              y: source.y + source.height,
            },
            target: { x: target.x + target.width / 2, y: target.y },
          },
        ]
      : [];
  });
  const branches = new Map<string, RoutingEndpoint[]>();
  const merges = new Map<string, RoutingEndpoint[]>();
  endpoints.forEach((endpoint) => {
    branches.set(endpoint.sourceId, [
      ...(branches.get(endpoint.sourceId) ?? []),
      endpoint,
    ]);
    merges.set(endpoint.targetId, [
      ...(merges.get(endpoint.targetId) ?? []),
      endpoint,
    ]);
  });
  const branchRails = new Map(
    [...branches]
      .filter(([, m]) => m.length > 1)
      .map(([id, m]) => [
        id,
        createBranchRail(
          id,
          m,
          nodes
            .filter((n) => n.id !== id && !m.some((e) => e.targetId === n.id))
            .map((n) => n.rectangle),
        ),
      ]),
  );
  const mergeRails = new Map(
    [...merges]
      .filter(([, m]) => m.length > 1)
      .map(([id, m]) => [
        id,
        createMergeRail(
          id,
          m,
          nodes
            .filter((n) => n.id !== id && !m.some((e) => e.sourceId === n.id))
            .map((n) => n.rectangle),
        ),
      ]),
  );
  const routed = endpoints.map((endpoint): RoutedRelationship => {
    const startStub = {
      x: endpoint.source.x,
      y: endpoint.source.y + EDGE_STUB,
    };
    const endStub = { x: endpoint.target.x, y: endpoint.target.y - EDGE_STUB };
    const obstacles = nodes
      .filter(
        (node) =>
          node.id !== endpoint.sourceId && node.id !== endpoint.targetId,
      )
      .map((node) => inflateRectangle(node.rectangle, OBJECT_CLEARANCE));
    // Rails describe shared ink, but the ordered per-relationship route still
    // has to use the visibility graph: a straight projection between rail
    // junctions can pass through a tall sibling card.
    const middle: OrthogonalRoute = routeOrthogonally(
      startStub,
      endStub,
      obstacles,
    );
    return {
      id: endpoint.relationshipId,
      relationshipId: endpoint.relationshipId,
      kind: "Causal",
      fromId: endpoint.sourceId,
      toId: endpoint.targetId,
      role: roles.get(endpoint.relationshipId)!,
      route: simplifyOrthogonalRoute([
        endpoint.source,
        ...middle,
        endpoint.target,
      ]),
    };
  });
  return {
    relationships: routed,
    sharedSegments: [...branchRails.values(), ...mergeRails.values()]
      .map((rail) => rail.segment)
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
};
