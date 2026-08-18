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

export type CausalRouteControl = Readonly<{
  relationshipId: string;
  controlId: string;
  rectangle: LayoutNodeGeometry["rectangle"];
}>;

/** Routes semantic relationships, optionally projecting Controls as ordered waypoints. */
export const routeCausalRelationships = (
  relationships: readonly CausalRelationship[],
  nodes: readonly LayoutNodeGeometry[],
  controls: readonly CausalRouteControl[] = [],
): CausalRoutingResult => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roles = classifyCausalRelationships(relationships);
  const controlsByRelationship = new Map(
    controls.map((control) => [control.relationshipId, control]),
  );
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
    const branchRail = branchRails.get(endpoint.sourceId);
    const mergeRail = mergeRails.get(endpoint.targetId);
    const control = controlsByRelationship.get(endpoint.relationshipId);
    const controlTop = control && {
      x: control.rectangle.x + control.rectangle.width / 2,
      y: control.rectangle.y,
    };
    const controlBottom = control && {
      x: controlTop!.x,
      y: control.rectangle.y + control.rectangle.height,
    };
    // Degree and rail selection belong to the semantic edge. Controls are
    // merely ordered waypoints on that route, never synthetic graph members.
    const waypoints = [
      ...(branchRail
        ? [
            { x: endpoint.source.x, y: branchRail.y },
            { x: controlTop?.x ?? endpoint.target.x, y: branchRail.y },
          ]
        : []),
      ...(!branchRail && controlTop
        ? [
            { x: endpoint.source.x, y: controlTop.y - EDGE_STUB },
            { x: controlTop.x, y: controlTop.y - EDGE_STUB },
          ]
        : []),
      ...(controlTop ? [controlTop, controlBottom!] : []),
      ...(mergeRail
        ? [
            { x: controlBottom?.x ?? endpoint.source.x, y: mergeRail.y },
            { x: endpoint.target.x, y: mergeRail.y },
          ]
        : []),
      ...(!mergeRail && controlBottom
        ? [{ x: controlBottom.x, y: endStub.y }, endStub]
        : []),
    ];
    const middle: OrthogonalRoute = waypoints.length
      ? ([startStub, ...waypoints, endStub] as unknown as OrthogonalRoute)
      : routeOrthogonally(startStub, endStub, obstacles);
    return {
      id: endpoint.relationshipId,
      relationshipId: endpoint.relationshipId,
      kind: "Causal",
      fromId: endpoint.sourceId,
      toId: endpoint.targetId,
      role: roles.get(endpoint.relationshipId)!,
      // Preserve explicit Control port points even when they are collinear;
      // adapters use those boundaries to derive the two handle-facing pieces.
      route: control
        ? ([
            endpoint.source,
            ...middle,
            endpoint.target,
          ] as unknown as OrthogonalRoute)
        : simplifyOrthogonalRoute([
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
