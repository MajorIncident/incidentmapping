import {
  ACTION_GUTTER,
  CARD_COLLISION_CLEARANCE,
  requiredRankInterval,
} from "./geometry/spacing";
import { rectanglesOverlap } from "./geometry/alignment";
import type { InvestigationLayoutInput, LayoutResult } from "./layoutModel";

export type LayoutHealthIssue = Readonly<{
  kind:
    | "SemanticOverlap"
    | "ControlClearance"
    | "ControlCollision"
    | "MissingRoute"
    | "MissingControlRoute"
    | "GrossActionDistance";
  ids: readonly string[];
}>;

/** Renderer-neutral compatibility check for geometry loaded from persisted maps. */
export const evaluateLayoutHealth = (
  graph: InvestigationLayoutInput,
  layout: LayoutResult,
): { healthy: boolean; issues: readonly LayoutHealthIssue[] } => {
  const issues: LayoutHealthIssue[] = [];
  const geometry = new Map(layout.nodes.map((node) => [node.id, node]));
  const semantics = layout.nodes.filter((node) => node.role === "Semantic");
  semantics.forEach((left, index) =>
    semantics.slice(index + 1).forEach((right) => {
      if (rectanglesOverlap(left.rectangle, right.rectangle, 0))
        issues.push({ kind: "SemanticOverlap", ids: [left.id, right.id] });
    }),
  );
  for (const control of graph.controls ?? []) {
    const source = geometry.get(control.upstreamNodeId)?.rectangle;
    const target = geometry.get(control.downstreamNodeId)?.rectangle;
    const projected = geometry.get(control.id)?.rectangle;
    if (!source || !target || !projected) {
      issues.push({ kind: "ControlCollision", ids: [control.id] });
      continue;
    }
    if (
      target.y - (source.y + source.height) + 0.5 <
      requiredRankInterval(false, [projected.height])
    )
      issues.push({
        kind: "ControlClearance",
        ids: [control.upstreamNodeId, control.id, control.downstreamNodeId],
      });
    const unrelated = layout.nodes.filter(
      (node) =>
        node.id !== control.id &&
        node.id !== control.upstreamNodeId &&
        node.id !== control.downstreamNodeId,
    );
    if (
      rectanglesOverlap(projected, source, CARD_COLLISION_CLEARANCE) ||
      rectanglesOverlap(projected, target, CARD_COLLISION_CLEARANCE) ||
      unrelated.some((node) => rectanglesOverlap(projected, node.rectangle, 0))
    )
      issues.push({ kind: "ControlCollision", ids: [control.id] });
    const prefix = `${control.relationshipId}-${control.id}`;
    const upstream = layout.relationships.find(
      (route) => route.id === `${prefix}-upstream`,
    );
    const downstream = layout.relationships.find(
      (route) => route.id === `${prefix}-downstream`,
    );
    if (
      !upstream ||
      upstream.route.length < 2 ||
      !downstream ||
      downstream.route.length < 2
    )
      issues.push({
        kind: "MissingControlRoute",
        ids: [control.relationshipId],
      });
  }
  graph.relationships
    .filter((edge) => edge.kind === "Causal")
    .forEach((edge) => {
      const route = layout.relationships.find((item) => item.id === edge.id);
      if (!route || route.route.length < 2)
        issues.push({ kind: "MissingRoute", ids: [edge.id] });
    });
  for (const action of graph.actions ?? []) {
    const source = geometry.get(action.attachedToId)?.rectangle;
    const rectangle = geometry.get(action.id)?.rectangle;
    if (!source || !rectangle) continue;
    const preferred = source.x + source.width + ACTION_GUTTER;
    const local = { ...rectangle, x: preferred };
    const localClear = layout.nodes.every(
      (node) =>
        node.id === action.id ||
        node.id === action.attachedToId ||
        !rectanglesOverlap(local, node.rectangle, CARD_COLLISION_CLEARANCE),
    );
    if (localClear && rectangle.x - preferred > rectangle.width * 2)
      issues.push({ kind: "GrossActionDistance", ids: [action.id] });
  }
  return { healthy: issues.length === 0, issues };
};
