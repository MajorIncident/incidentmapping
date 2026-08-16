import { z } from "zod";
import {
  actionStatusSchema,
  barrierStatusSchema,
  incidentStatusSchema,
  mapDataV2Schema,
  mapDataV1Schema,
  severitySchema,
  type MapDataV2 as MapData,
} from "./schema";

const versionEnvelope = z.object({ schemaVersion: z.number() });

// Version 2 files written before the current contract have retired fields and
// enum spellings. Keep their input shape isolated from canonical V2 output.
const legacyV2NodeSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal("ChainNode"),
    referenceId: z.string().min(1),
    nodeType: z.enum(["Event", "Factor", "Impact", "Action"]),
    title: z.string().min(1),
    description: z.string().optional(),
    owner: z.string().optional(),
    timestamp: z.string().optional(),
    severity: severitySchema.optional(),
    // Retired node-level investigation status is accepted only at this boundary.
    incidentStatus: incidentStatusSchema.optional(),
    factorCategory: z
      .enum([
        "Human",
        "Process",
        "Equipment",
        "Technology",
        "Communication",
        "Environment",
        "Organizational",
        "Other",
        "Procedure",
        "Organization",
      ])
      .optional(),
    evidenceItems: z.array(
      z
        .object({ id: z.string().min(1), text: z.string().trim().min(1) })
        .strict(),
    ),
    evidenceHighWaterMark: z.number().int().nonnegative().optional(),
    factorSignificance: z.enum(["Normal", "KeyFactor", "RootCause"]).optional(),
    actionStatus: actionStatusSchema.optional(),
    actionDueDate: z.string().optional(),
    positiveConsequenceBulletPoints: z.array(z.string()),
    negativeConsequenceBulletPoints: z.array(z.string()),
    position: z.object({ x: z.number(), y: z.number() }).strict(),
  })
  .strict();
const legacyV2EdgeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("CauseEffectEdge"),
      fromId: z.string().min(1),
      toId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      kind: z.literal("ActionEdge"),
      fromId: z.string().min(1),
      toId: z.string().min(1),
      status: actionStatusSchema.optional(),
      dueDate: z.string().optional(),
    })
    .strict(),
]);
const legacyV2BarrierSchema = z
  .object({
    id: z.string().min(1),
    kind: z.literal("Barrier"),
    upstreamNodeId: z.string().min(1),
    downstreamNodeId: z.string().min(1),
    description: z.string().optional(),
    status: barrierStatusSchema,
    failureReason: z
      .enum([
        "NotFollowed",
        "Bypassed",
        "IncorrectConfiguration",
        "SystemFailure",
        "InadequateDesign",
        "Unavailable",
        "NotInPlace",
        "Unknown",
        "Other",
        "Absent",
        "Inadequate",
        "NotUsed",
        "Failed",
      ])
      .optional(),
    failureDetails: z.string().optional(),
  })
  .strict();
const legacyV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    metadata: z
      .object({
        title: z.string().trim().min(1).optional(),
        incidentId: z.string().trim().min(1).optional(),
        occurredAt: z.string().trim().min(1).optional(),
        location: z.string().trim().min(1).optional(),
        severity: severitySchema.optional(),
        status: incidentStatusSchema.optional(),
        nodeReferenceHighWaterMark: z.number().int().nonnegative().optional(),
        evidenceReferenceHighWaterMark: z
          .number()
          .int()
          .nonnegative()
          .optional(),
      })
      .strict()
      .optional(),
    nodes: z.array(legacyV2NodeSchema),
    edges: z.array(legacyV2EdgeSchema),
    barriers: z.array(legacyV2BarrierSchema),
  })
  .strict();

const categoryMap = {
  Procedure: "Process",
  Organization: "Organizational",
} as const;
const failureMap = {
  Absent: "NotInPlace",
  Inadequate: "InadequateDesign",
  NotUsed: "NotFollowed",
  Failed: "SystemFailure",
} as const;

const validate = (value: unknown): MapData => {
  const result = mapDataV2Schema.safeParse(value);
  if (result.success) return result.data;
  const graphIssue = result.error.issues.find((item) => item.code === "custom");
  if (graphIssue) throw new Error(graphIssue.message);
  throw result.error;
};

const normalizeV2 = (input: unknown): MapData => {
  const legacy = legacyV2Schema.parse(input);
  let evidenceNumber = 0;
  const nodes = legacy.nodes.map(
    ({
      evidenceHighWaterMark: _retired,
      incidentStatus: _discardedNodeStatus,
      factorCategory,
      ...node
    }) => ({
      ...node,
      ...(factorCategory
        ? {
            factorCategory:
              factorCategory in categoryMap
                ? categoryMap[factorCategory as keyof typeof categoryMap]
                : factorCategory,
          }
        : {}),
      evidenceItems: node.evidenceItems.map(({ text }) => ({
        id: `EV-${String(++evidenceNumber).padStart(3, "0")}`,
        text,
      })),
    }),
  );
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = legacy.edges.map((edge) => {
    if (edge.kind === "ActionEdge") {
      const target = byId.get(edge.toId);
      if (target) {
        if (target.actionStatus === undefined && edge.status !== undefined)
          target.actionStatus = edge.status;
        if (target.actionDueDate === undefined && edge.dueDate !== undefined)
          target.actionDueDate = edge.dueDate;
      }
    }
    return {
      id: edge.id,
      kind: edge.kind,
      fromId: edge.fromId,
      toId: edge.toId,
    };
  });
  return validate({
    schemaVersion: 2,
    metadata: {
      ...(legacy.metadata ?? {}),
      evidenceReferenceHighWaterMark: evidenceNumber,
    },
    nodes,
    edges,
    barriers: legacy.barriers.map(({ failureReason, ...control }) => ({
      ...control,
      ...(failureReason
        ? {
            failureReason:
              failureReason in failureMap
                ? failureMap[failureReason as keyof typeof failureMap]
                : failureReason,
          }
        : {}),
    })),
  });
};

export const migrateMapDataV1 = (input: unknown): MapData => {
  const legacy = mapDataV1Schema.parse(input);
  return validate({
    schemaVersion: 2,
    metadata: {
      ...legacy.metadata,
      nodeReferenceHighWaterMark: legacy.nodes.length,
      evidenceReferenceHighWaterMark: 0,
    },
    nodes: legacy.nodes.map((node, index) => ({
      ...node,
      referenceId: `N-${String(index + 1).padStart(3, "0")}`,
      nodeType: "Event",
      evidenceItems: [],
    })),
    edges: legacy.edges,
    barriers: legacy.barriers.map(({ breached, breachedItems, ...barrier }) => {
      const details = breachedItems.filter(Boolean).join("\n");
      return {
        ...barrier,
        status: breached ? "Failed" : "Effective",
        ...(details ? { failureDetails: details } : {}),
      };
    }),
  });
};

/** The sole boundary for untrusted persisted map JSON. */
export const parseAndMigrateMapData = (input: unknown): MapData => {
  const { schemaVersion } = versionEnvelope.parse(input);
  if (schemaVersion === 1) return migrateMapDataV1(input);
  if (schemaVersion === 2) {
    const canonical = mapDataV2Schema.safeParse(input);
    if (canonical.success) return canonical.data;
    return normalizeV2(input);
  }
  throw new Error(`Unsupported map schema version: ${schemaVersion}`);
};
