import { z } from "zod";

const strictObject = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).strict();
export const severitySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const incidentStatusSchema = z.enum([
  "Draft",
  "Open",
  "InProgress",
  "Closed",
]);
export const nodeTypeSchema = z.enum(["Event", "Factor", "Impact", "Action"]);
export const factorCategorySchema = z.enum([
  "Human",
  "Process",
  "Equipment",
  "Technology",
  "Communication",
  "Environment",
  "Organizational",
  "Other",
]);
export const factorSignificanceSchema = z.enum([
  "Normal",
  "KeyFactor",
  "RootCause",
]);
export const actionStatusSchema = z.enum([
  "Proposed",
  "Planned",
  "InProgress",
  "Completed",
  "Cancelled",
]);
export const barrierStatusSchema = z.enum([
  "Effective",
  "Degraded",
  "Failed",
  "Missing",
]);
export const barrierFailureReasonSchema = z.enum([
  "NotFollowed",
  "Bypassed",
  "IncorrectConfiguration",
  "SystemFailure",
  "InadequateDesign",
  "Unavailable",
  "NotInPlace",
  "Unknown",
  "Other",
]);

export const positionSchema = strictObject({ x: z.number(), y: z.number() });
export const evidenceItemSchema = strictObject({
  id: z.string().min(1),
  text: z.string().trim().min(1),
});

// V1 is deliberately independent: current defaults and enums cannot change its meaning.
export const chainNodeV1Schema = z.object({
  id: z.string().min(1),
  kind: z.literal("ChainNode"),
  title: z.string().min(1),
  description: z.string().optional(),
  owner: z.string().optional(),
  timestamp: z.string().optional(),
  positiveConsequenceBulletPoints: z.array(z.string()).default([]),
  negativeConsequenceBulletPoints: z.array(z.string()).default([]),
  position: z.object({ x: z.number(), y: z.number() }),
});
export const causeEffectEdgeV1Schema = z.object({
  id: z.string().min(1),
  kind: z.literal("CauseEffectEdge"),
  fromId: z.string().min(1),
  toId: z.string().min(1),
});
export const barrierV1Schema = z.object({
  id: z.string().min(1),
  kind: z.literal("Barrier"),
  upstreamNodeId: z.string().min(1),
  downstreamNodeId: z.string().min(1),
  description: z.string().optional(),
  breached: z.boolean(),
  breachedItems: z.array(z.string()).default([]),
});
export const metadataV1Schema = z
  .object({ title: z.string().optional() })
  .optional();
export const mapDataV1Schema = z.object({
  schemaVersion: z.literal(1),
  metadata: metadataV1Schema,
  nodes: z.array(chainNodeV1Schema),
  edges: z.array(causeEffectEdgeV1Schema),
  barriers: z.array(barrierV1Schema).default([]),
});

export const chainNodeSchema = strictObject({
  id: z.string().min(1),
  kind: z.literal("ChainNode"),
  referenceId: z.string().min(1),
  nodeType: nodeTypeSchema,
  title: z.string().min(1, "ChainNode title is required"),
  description: z.string().optional(),
  owner: z.string().optional(),
  timestamp: z.string().optional(),
  severity: severitySchema.optional(),
  incidentStatus: incidentStatusSchema.optional(),
  factorCategory: factorCategorySchema.optional(),
  factorSignificance: factorSignificanceSchema.optional(),
  actionStatus: actionStatusSchema.optional(),
  actionDueDate: z.string().optional(),
  positiveConsequenceBulletPoints: z.array(z.string()),
  negativeConsequenceBulletPoints: z.array(z.string()),
  evidenceItems: z.array(evidenceItemSchema),
  position: positionSchema,
});
export const causeEffectEdgeSchema = strictObject({
  id: z.string().min(1),
  kind: z.literal("CauseEffectEdge"),
  fromId: z.string().min(1),
  toId: z.string().min(1),
});
export const actionEdgeSchema = strictObject({
  id: z.string().min(1),
  kind: z.literal("ActionEdge"),
  fromId: z.string().min(1),
  toId: z.string().min(1),
});
export const relationshipEdgeSchema = z.discriminatedUnion("kind", [
  causeEffectEdgeSchema,
  actionEdgeSchema,
]);
export const barrierSchema = strictObject({
  id: z.string().min(1),
  kind: z.literal("Barrier"), // persisted name retained for wire compatibility; UI calls this a Control
  upstreamNodeId: z.string().min(1),
  downstreamNodeId: z.string().min(1),
  description: z.string().optional(),
  status: barrierStatusSchema,
  failureReason: barrierFailureReasonSchema.optional(),
  failureDetails: z.string().optional(),
});
const optionalMetadataText = z.string().trim().min(1).optional();
export const metadataSchema = strictObject({
  title: optionalMetadataText,
  incidentId: optionalMetadataText,
  occurredAt: optionalMetadataText,
  location: optionalMetadataText,
  severity: severitySchema.optional(),
  status: incidentStatusSchema.optional(),
  nodeReferenceHighWaterMark: z.number().int().nonnegative().optional(),
  evidenceReferenceHighWaterMark: z.number().int().nonnegative().optional(),
}).optional();

const issue = (
  ctx: z.RefinementCtx,
  message: string,
  path: (string | number)[] = [],
) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

export const mapDataSchema = strictObject({
  schemaVersion: z.literal(2),
  metadata: metadataSchema,
  nodes: z.array(chainNodeSchema),
  edges: z.array(relationshipEdgeSchema),
  barriers: z.array(barrierSchema),
}).superRefine((map, ctx) => {
  const seen = (values: string[], label: string) => {
    const ids = new Set<string>();
    values.forEach((value) =>
      ids.has(value)
        ? issue(ctx, `Duplicate ${label}: ${value}`)
        : void ids.add(value),
    );
  };
  seen(
    map.nodes.map((node) => node.id),
    "node ID",
  );
  seen(
    map.nodes.map((node) => node.referenceId),
    "node reference ID",
  );
  seen(
    map.edges.map((edge) => edge.id),
    "edge ID",
  );
  seen(
    map.barriers.map((control) => control.id),
    "control ID",
  );
  seen(
    map.nodes.flatMap((node) => node.evidenceItems.map((item) => item.id)),
    "evidence ID",
  );

  const nodes = new Map(map.nodes.map((node) => [node.id, node]));
  const causalPairs = new Set<string>();
  const actionPairs = new Set<string>();
  const incomingActions = new Map<string, number>();
  for (const edge of map.edges) {
    const from = nodes.get(edge.fromId);
    const to = nodes.get(edge.toId);
    if (!from) issue(ctx, `Missing edge source: ${edge.fromId}`);
    if (!to) issue(ctx, `Missing edge target: ${edge.toId}`);
    if (edge.kind === "CauseEffectEdge") {
      if (from?.nodeType === "Action" || to?.nodeType === "Action")
        issue(ctx, `Causal edge touches Action node: ${edge.id}`);
      const pair = `${edge.fromId}\u0000${edge.toId}`;
      if (causalPairs.has(pair))
        issue(
          ctx,
          `Duplicate causal relationship: ${edge.fromId} -> ${edge.toId}`,
        );
      causalPairs.add(pair);
    } else {
      if (from?.nodeType === "Action")
        issue(ctx, `ActionEdge source is an Action: ${edge.fromId}`);
      if (to && to.nodeType !== "Action")
        issue(ctx, `ActionEdge target is not an Action: ${edge.toId}`);
      if (from?.nodeType === "Action" && to?.nodeType === "Action")
        issue(
          ctx,
          `Action-to-Action relationship: ${edge.fromId} -> ${edge.toId}`,
        );
      const pair = `${edge.fromId}\u0000${edge.toId}`;
      if (actionPairs.has(pair))
        issue(
          ctx,
          `Duplicate action relationship: ${edge.fromId} -> ${edge.toId}`,
        );
      actionPairs.add(pair);
      incomingActions.set(edge.toId, (incomingActions.get(edge.toId) ?? 0) + 1);
    }
  }
  for (const node of map.nodes.filter((node) => node.nodeType === "Action")) {
    const count = incomingActions.get(node.id) ?? 0;
    if (count === 0) issue(ctx, `Orphaned Action: ${node.id}`);
    if (count > 1)
      issue(ctx, `Action has multiple incoming ActionEdges: ${node.id}`);
  }
  for (const control of map.barriers) {
    if (!nodes.has(control.upstreamNodeId))
      issue(ctx, `Missing control source: ${control.upstreamNodeId}`);
    if (!nodes.has(control.downstreamNodeId))
      issue(ctx, `Missing control target: ${control.downstreamNodeId}`);
    if (
      !causalPairs.has(
        `${control.upstreamNodeId}\u0000${control.downstreamNodeId}`,
      )
    )
      issue(
        ctx,
        `Control does not match a causal relationship: ${control.upstreamNodeId} -> ${control.downstreamNodeId}`,
      );
  }
});

export type MapDataV1 = z.infer<typeof mapDataV1Schema>;
export type MapData = z.infer<typeof mapDataSchema>;
export type ChainNode = z.infer<typeof chainNodeSchema>;
export type RelationshipEdge = z.infer<typeof relationshipEdgeSchema>;
export type CauseEffectEdge = z.infer<typeof causeEffectEdgeSchema>;
export type ActionEdge = z.infer<typeof actionEdgeSchema>;
export type Barrier = z.infer<typeof barrierSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type MapMetadata = NonNullable<MapData["metadata"]>;
