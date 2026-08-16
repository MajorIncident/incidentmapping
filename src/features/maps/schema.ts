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
  "Equipment",
  "Environment",
  "Procedure",
  "Organization",
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
  "Absent",
  "Inadequate",
  "NotUsed",
  "Failed",
  "Unknown",
]);

export const positionSchema = strictObject({ x: z.number(), y: z.number() });

export const evidenceItemSchema = strictObject({
  id: z.string().min(1),
  text: z.string().trim().min(1),
});

// V1 remains deliberately independent: changing V2 defaults must never change migration.
export const chainNodeV1Schema = z.object({
  id: z.string().min(1),
  kind: z.literal("ChainNode"),
  title: z.string().min(1, "ChainNode title is required"),
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
  positiveConsequenceBulletPoints: z.array(z.string()),
  negativeConsequenceBulletPoints: z.array(z.string()),
  evidenceItems: z.array(evidenceItemSchema),
  evidenceHighWaterMark: z.number().int().nonnegative().optional(),
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
  status: actionStatusSchema.optional(),
  dueDate: z.string().optional(),
});
export const relationshipEdgeSchema = z.discriminatedUnion("kind", [
  causeEffectEdgeSchema,
  actionEdgeSchema,
]);
export const barrierSchema = strictObject({
  id: z.string().min(1),
  kind: z.literal("Barrier"),
  upstreamNodeId: z.string().min(1),
  downstreamNodeId: z.string().min(1),
  description: z.string().optional(),
  status: barrierStatusSchema,
  failureReason: barrierFailureReasonSchema.optional(),
  failureDetails: z.string().optional(),
});
export const metadataSchema = strictObject({
  title: z.string().optional(),
  incidentDate: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  nodeReferenceHighWaterMark: z.number().int().nonnegative().optional(),
}).optional();
export const mapDataSchema = strictObject({
  schemaVersion: z.literal(2),
  metadata: metadataSchema,
  nodes: z.array(chainNodeSchema),
  edges: z.array(relationshipEdgeSchema),
  barriers: z.array(barrierSchema),
});

export type MapDataV1 = z.infer<typeof mapDataV1Schema>;
export type MapData = z.infer<typeof mapDataSchema>;
export type ChainNode = z.infer<typeof chainNodeSchema>;
export type RelationshipEdge = z.infer<typeof relationshipEdgeSchema>;
export type CauseEffectEdge = z.infer<typeof causeEffectEdgeSchema>;
export type ActionEdge = z.infer<typeof actionEdgeSchema>;
export type Barrier = z.infer<typeof barrierSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
