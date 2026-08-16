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
export const eventPhaseSchema = z.enum([
  "Precursor",
  "Incident",
  "Detection",
  "Response",
  "Recovery",
]);
export const actionTypeSchema = z.enum([
  "Immediate",
  "Corrective",
  "Preventive",
]);
export const controlRoleSchema = z.enum([
  "Preventive",
  "Detective",
  "Mitigating",
]);
export const evidenceTypeSchema = z.enum([
  "Note",
  "Photo",
  "Video",
  "Document",
  "SystemLog",
  "Interview",
  "Other",
]);

export type EventPhase = z.infer<typeof eventPhaseSchema>;
export type ActionType = z.infer<typeof actionTypeSchema>;
export type ControlRole = z.infer<typeof controlRoleSchema>;
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

export const positionSchema = strictObject({ x: z.number(), y: z.number() });
const evidenceItemV2Schema = strictObject({
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

// V2 is frozen for import/migration. Do not make current-contract changes here.
export const chainNodeV2Schema = strictObject({
  id: z.string().min(1),
  kind: z.literal("ChainNode"),
  referenceId: z.string().min(1),
  nodeType: nodeTypeSchema,
  title: z.string().min(1, "ChainNode title is required"),
  description: z.string().optional(),
  owner: z.string().optional(),
  timestamp: z.string().optional(),
  severity: severitySchema.optional(),
  factorCategory: factorCategorySchema.optional(),
  factorSignificance: factorSignificanceSchema.optional(),
  actionStatus: actionStatusSchema.optional(),
  actionDueDate: z.string().optional(),
  positiveConsequenceBulletPoints: z.array(z.string()),
  negativeConsequenceBulletPoints: z.array(z.string()),
  evidenceItems: z.array(evidenceItemV2Schema),
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
export const metadataV2Schema = strictObject({
  title: optionalMetadataText,
  incidentId: optionalMetadataText,
  occurredAt: optionalMetadataText,
  location: optionalMetadataText,
  severity: severitySchema.optional(),
  status: incidentStatusSchema.optional(),
  nodeReferenceHighWaterMark: z.number().int().nonnegative().optional(),
  evidenceReferenceHighWaterMark: z.number().int().nonnegative().optional(),
}).optional();

export const mapDataV2Schema = strictObject({
  schemaVersion: z.literal(2),
  metadata: metadataV2Schema,
  nodes: z.array(chainNodeV2Schema),
  edges: z.array(relationshipEdgeSchema),
  barriers: z.array(barrierSchema),
});

export const contextItemV3Schema = strictObject({
  id: z.string().min(1),
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
  showOnCard: z.boolean().optional(),
});
export const evidenceItemV3Schema = strictObject({
  id: z.string().min(1),
  type: evidenceTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  source: z.string().optional(),
  reference: z.string().optional(),
});
export const chainNodeV3Schema = strictObject({
  id: z.string().min(1),
  kind: z.literal("ChainNode"),
  referenceId: z.string().min(1),
  nodeType: nodeTypeSchema,
  title: z.string().min(1, "ChainNode title is required"),
  description: z.string().optional(),
  owner: z.string().optional(),
  timestamp: z.string().optional(),
  severity: severitySchema.optional(),
  factorCategory: factorCategorySchema.optional(),
  factorSignificance: factorSignificanceSchema.optional(),
  actionStatus: actionStatusSchema.optional(),
  actionDueDate: z.string().optional(),
  eventPhase: eventPhaseSchema.optional(),
  actionType: actionTypeSchema.optional(),
  positiveConsequenceBulletPoints: z.array(z.string()),
  negativeConsequenceBulletPoints: z.array(z.string()),
  evidenceIds: z.array(z.string().min(1)),
  contextItems: z.array(contextItemV3Schema),
  position: positionSchema,
});
export const controlV3Schema = barrierSchema.extend({
  controlRole: controlRoleSchema.optional(),
  evidenceIds: z.array(z.string().min(1)),
});
export const metadataV3Schema = strictObject({
  title: optionalMetadataText,
  incidentId: optionalMetadataText,
  occurredAt: optionalMetadataText,
  location: optionalMetadataText,
  severity: severitySchema.optional(),
  status: incidentStatusSchema.optional(),
  nodeReferenceHighWaterMark: z.number().int().nonnegative().optional(),
  evidenceReferenceHighWaterMark: z.number().int().nonnegative().optional(),
  contextItems: z.array(contextItemV3Schema).default([]),
}).optional();

const issue = (
  ctx: z.RefinementCtx,
  message: string,
  path: (string | number)[] = [],
) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

export const mapDataV3Schema = strictObject({
  schemaVersion: z.literal(3),
  metadata: metadataV3Schema,
  nodes: z.array(chainNodeV3Schema),
  edges: z.array(relationshipEdgeSchema),
  barriers: z.array(controlV3Schema),
  evidence: z.array(evidenceItemV3Schema),
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
  const registryIds = new Set<string>();
  map.evidence.forEach((item, index) => {
    if (registryIds.has(item.id))
      issue(ctx, `Duplicate evidence ID: ${item.id}`, [
        "evidence",
        index,
        "id",
      ]);
    registryIds.add(item.id);
  });

  const evidenceIds = new Set(map.evidence.map((item) => item.id));
  const checkEvidence = (ids: string[], path: (string | number)[]) => {
    const local = new Set<string>();
    ids.forEach((id, index) => {
      if (local.has(id))
        issue(ctx, `Duplicate evidence reference: ${id}`, [...path, index]);
      local.add(id);
      if (!evidenceIds.has(id))
        issue(ctx, `Missing evidence reference: ${id}`, [...path, index]);
    });
  };
  map.nodes.forEach((node, index) => {
    checkEvidence(node.evidenceIds, ["nodes", index, "evidenceIds"]);
    if (node.nodeType !== "Event" && node.eventPhase !== undefined)
      issue(ctx, "Event Phase is only valid on Events", [
        "nodes",
        index,
        "eventPhase",
      ]);
    if (node.nodeType !== "Action") {
      if (node.actionType !== undefined)
        issue(ctx, "Action Type is only valid on Actions", [
          "nodes",
          index,
          "actionType",
        ]);
      if (node.actionStatus !== undefined)
        issue(ctx, "Action status is only valid on Actions", [
          "nodes",
          index,
          "actionStatus",
        ]);
      if (node.actionDueDate !== undefined)
        issue(ctx, "Action due date is only valid on Actions", [
          "nodes",
          index,
          "actionDueDate",
        ]);
    }
    if (node.nodeType !== "Factor") {
      if (node.factorCategory !== undefined)
        issue(ctx, "Factor category is only valid on Factors", [
          "nodes",
          index,
          "factorCategory",
        ]);
      if (node.factorSignificance !== undefined)
        issue(ctx, "Factor significance is only valid on Factors", [
          "nodes",
          index,
          "factorSignificance",
        ]);
    }
    if (node.nodeType === "Action" && node.contextItems.length)
      issue(ctx, "Context is not valid on Actions", [
        "nodes",
        index,
        "contextItems",
      ]);
  });
  map.barriers.forEach((control, index) =>
    checkEvidence(control.evidenceIds, ["barriers", index, "evidenceIds"]),
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
export type MapDataV2 = z.infer<typeof mapDataV2Schema>;
export type ChainNodeV2 = z.infer<typeof chainNodeV2Schema>;
export type MapDataV3 = z.infer<typeof mapDataV3Schema>;
export type ChainNodeV3 = z.infer<typeof chainNodeV3Schema>;
export type EvidenceItemV3 = z.infer<typeof evidenceItemV3Schema>;
export type ContextItemV3 = z.infer<typeof contextItemV3Schema>;
export type RelationshipEdge = z.infer<typeof relationshipEdgeSchema>;
export type CauseEffectEdge = z.infer<typeof causeEffectEdgeSchema>;
export type ActionEdge = z.infer<typeof actionEdgeSchema>;
export type Barrier = z.infer<typeof barrierSchema>;
export type MapMetadataV3 = NonNullable<MapDataV3["metadata"]>;
export type MapMetadataV2 = NonNullable<MapDataV2["metadata"]>;

// V3 above is frozen as an import-only contract. All newly persisted maps use V4.
export const eventDisplaySchema = z.enum(["Map", "ChronologyOnly"]);
export const assertionStateSchema = z.enum([
  "Confirmed",
  "Working",
  "Inferred",
]);
export const contextDisplayModeSchema = z.enum(["Text", "Metric"]);
export const attachmentMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
]);

export const contextItemSchema = strictObject({
  id: z.string().min(1),
  label: z.string().trim().min(1),
  value: z.string().trim().min(1),
  showOnCard: z.boolean().optional(),
  displayMode: contextDisplayModeSchema,
  unit: z.string().trim().min(1).optional(),
});
export const evidenceItemSchema = strictObject({
  id: z.string().min(1),
  type: evidenceTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  source: z.string().optional(),
  reference: z.string().optional(),
  attachmentIds: z.array(z.string().min(1)),
  externalUrl: z.string().url().optional(),
});
export const attachmentSchema = strictObject({
  id: z.string().min(1),
  filename: z.string().trim().min(1),
  mimeType: attachmentMimeTypeSchema,
  size: z.number().int().nonnegative(),
  bundlePath: z.string().trim().min(1),
  sha256: z
    .string()
    .regex(
      /^[a-fA-F0-9]{64}$/,
      "SHA-256 must contain 64 hexadecimal characters",
    )
    .optional(),
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
  endTimestamp: z.string().optional(),
  eventDisplay: eventDisplaySchema.optional(),
  severity: severitySchema.optional(),
  factorCategory: factorCategorySchema.optional(),
  factorSignificance: factorSignificanceSchema.optional(),
  assertionState: assertionStateSchema.optional(),
  actionStatus: actionStatusSchema.optional(),
  actionDueDate: z.string().optional(),
  actionCompletedAt: z.string().optional(),
  eventPhase: eventPhaseSchema.optional(),
  actionType: actionTypeSchema.optional(),
  positiveConsequenceBulletPoints: z.array(z.string()),
  negativeConsequenceBulletPoints: z.array(z.string()),
  evidenceIds: z.array(z.string().min(1)),
  contextItems: z.array(contextItemSchema),
  position: positionSchema,
});
export const controlSchema = barrierSchema
  .extend({
    referenceId: z.string().min(1),
    controlRole: controlRoleSchema.optional(),
    assertionState: assertionStateSchema.optional(),
    evidenceIds: z.array(z.string().min(1)),
  })
  .strict();
export const metadataSchema = strictObject({
  title: optionalMetadataText,
  incidentId: optionalMetadataText,
  occurredAt: optionalMetadataText,
  location: optionalMetadataText,
  severity: severitySchema.optional(),
  status: incidentStatusSchema.optional(),
  nodeReferenceHighWaterMark: z.number().int().nonnegative().optional(),
  evidenceReferenceHighWaterMark: z.number().int().nonnegative().optional(),
  controlReferenceHighWaterMark: z.number().int().nonnegative().optional(),
  attachmentReferenceHighWaterMark: z.number().int().nonnegative().optional(),
  contextItems: z.array(contextItemSchema).default([]),
}).optional();

export const mapDataSchema = strictObject({
  schemaVersion: z.literal(4),
  metadata: metadataSchema,
  nodes: z.array(chainNodeSchema),
  edges: z.array(relationshipEdgeSchema),
  barriers: z.array(controlSchema),
  evidence: z.array(evidenceItemSchema),
  attachments: z.array(attachmentSchema),
}).superRefine((map, ctx) => {
  // Reuse every frozen V3 graph/reference invariant after removing V4-only data.
  const legacy = mapDataV3Schema.safeParse({
    schemaVersion: 3,
    metadata:
      map.metadata &&
      (() => {
        const {
          controlReferenceHighWaterMark: _control,
          attachmentReferenceHighWaterMark: _attachment,
          contextItems,
          ...metadata
        } = map.metadata;
        return {
          ...metadata,
          contextItems: contextItems.map(
            ({ displayMode: _d, unit: _u, ...item }) => item,
          ),
        };
      })(),
    nodes: map.nodes.map(
      ({
        endTimestamp: _end,
        eventDisplay: _display,
        assertionState: _assertion,
        actionCompletedAt: _completed,
        contextItems,
        ...node
      }) => ({
        ...node,
        contextItems: contextItems.map(
          ({ displayMode: _d, unit: _u, ...item }) => item,
        ),
      }),
    ),
    edges: map.edges,
    barriers: map.barriers.map(
      ({ referenceId: _ref, assertionState: _assertion, ...control }) =>
        control,
    ),
    evidence: map.evidence.map(
      ({ attachmentIds: _ids, externalUrl: _url, ...item }) => item,
    ),
  });
  if (!legacy.success)
    legacy.error.issues.forEach((item) => ctx.addIssue(item));
  const duplicate = (values: string[], label: string, path: string) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value))
        issue(ctx, `Duplicate ${label}: ${value}`, [path, index]);
      seen.add(value);
    });
  };
  duplicate(
    map.barriers.map((item) => item.referenceId),
    "control reference ID",
    "barriers",
  );
  duplicate(
    map.attachments.map((item) => item.id),
    "attachment ID",
    "attachments",
  );
  duplicate(
    map.attachments.map((item) => item.bundlePath),
    "attachment bundle path",
    "attachments",
  );
  const attachmentIds = new Set(map.attachments.map((item) => item.id));
  map.evidence.forEach((evidence, evidenceIndex) => {
    const local = new Set<string>();
    evidence.attachmentIds.forEach((id, index) => {
      if (local.has(id))
        issue(ctx, `Duplicate attachment reference: ${id}`, [
          "evidence",
          evidenceIndex,
          "attachmentIds",
          index,
        ]);
      local.add(id);
      if (!attachmentIds.has(id))
        issue(ctx, `Missing attachment reference: ${id}`, [
          "evidence",
          evidenceIndex,
          "attachmentIds",
          index,
        ]);
    });
  });
  const checkContext = (items: ContextItem[], path: (string | number)[]) =>
    items.forEach((item, index) => {
      if (item.displayMode !== "Metric" && item.unit !== undefined)
        issue(ctx, "Context unit is only valid for Metric display", [
          ...path,
          index,
          "unit",
        ]);
    });
  checkContext(map.metadata?.contextItems ?? [], ["metadata", "contextItems"]);
  map.nodes.forEach((node, index) => {
    checkContext(node.contextItems, ["nodes", index, "contextItems"]);
    const eventFields = [
      ["eventDisplay", node.eventDisplay],
      ["endTimestamp", node.endTimestamp],
    ] as const;
    if (node.nodeType === "Event" && node.eventDisplay === undefined)
      issue(ctx, "eventDisplay is required on Events", [
        "nodes",
        index,
        "eventDisplay",
      ]);
    if (node.nodeType !== "Event")
      eventFields.forEach(
        ([field, value]) =>
          value !== undefined &&
          issue(ctx, `${field} is only valid on Events`, [
            "nodes",
            index,
            field,
          ]),
      );
    if (node.nodeType !== "Action" && node.actionCompletedAt !== undefined)
      issue(ctx, "actionCompletedAt is only valid on Actions", [
        "nodes",
        index,
        "actionCompletedAt",
      ]);
    if (node.nodeType !== "Factor" && node.assertionState !== undefined)
      issue(ctx, "assertionState is only valid on Factors", [
        "nodes",
        index,
        "assertionState",
      ]);
    if (
      node.nodeType === "Event" &&
      node.timestamp !== undefined &&
      node.endTimestamp !== undefined
    ) {
      const start = Date.parse(node.timestamp),
        end = Date.parse(node.endTimestamp);
      if (!Number.isNaN(start) && !Number.isNaN(end) && end < start)
        issue(ctx, "Event end time cannot be earlier than its start time", [
          "nodes",
          index,
          "endTimestamp",
        ]);
    }
  });
});

export type EventDisplay = z.infer<typeof eventDisplaySchema>;
export type AssertionState = z.infer<typeof assertionStateSchema>;
export type ContextDisplayMode = z.infer<typeof contextDisplayModeSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type MapData = z.infer<typeof mapDataSchema>;
export type ChainNode = z.infer<typeof chainNodeSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type ContextItem = z.infer<typeof contextItemSchema>;
export type MapMetadata = NonNullable<MapData["metadata"]>;
