import { z } from "zod";
import {
  actionStatusSchema,
  barrierStatusSchema,
  incidentStatusSchema,
  mapDataSchema,
  mapDataV4Schema,
  mapDataV3Schema,
  mapDataV2Schema,
  mapDataV1Schema,
  severitySchema,
  type MapData,
  type MapDataV4,
  type MapDataV3,
  type MapDataV2,
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
  const result = mapDataSchema.safeParse(value);
  if (result.success) return result.data;
  const graphIssue = result.error.issues.find((item) => item.code === "custom");
  if (graphIssue) throw new Error(graphIssue.message);
  throw result.error;
};

const parseLegacyV2 = (input: unknown): MapDataV2 => {
  const legacy = legacyV2Schema.parse(input);
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
      evidenceItems: node.evidenceItems,
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
  return mapDataV2Schema.parse({
    schemaVersion: 2,
    metadata: {
      ...(legacy.metadata ?? {}),
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

const evidenceNumber = (id: string): number => {
  const match = /^EV-(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
};

const migrateV2 = (legacy: MapDataV2): MapDataV3 => {
  const evidence = legacy.nodes.flatMap((node) =>
    node.evidenceItems.map((item) => ({
      id: item.id,
      type: "Note" as const,
      title: item.text,
    })),
  );
  const largestEvidenceId = evidence.reduce(
    (largest, item) => Math.max(largest, evidenceNumber(item.id)),
    0,
  );

  return mapDataV3Schema.parse({
    schemaVersion: 3,
    metadata: {
      ...(legacy.metadata ?? {}),
      evidenceReferenceHighWaterMark: Math.max(
        legacy.metadata?.evidenceReferenceHighWaterMark ?? 0,
        largestEvidenceId,
      ),
      contextItems: [],
    },
    nodes: legacy.nodes.map(({ evidenceItems, ...node }) => ({
      ...node,
      evidenceIds: evidenceItems.map((item) => item.id),
      contextItems: [],
    })),
    edges: legacy.edges,
    barriers: legacy.barriers.map((control) => ({
      ...control,
      evidenceIds: [],
    })),
    evidence,
  });
};

const migrateMapDataV1ToV3 = (input: unknown): MapDataV3 => {
  const legacy = mapDataV1Schema.parse(input);
  return migrateV2({
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

const referenceNumber = (id: string, prefix: string): number => {
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(id);
  return match ? Number(match[1]) : 0;
};

const migrateMapDataV3ToV4 = (input: unknown): MapDataV4 => {
  const legacy = mapDataV3Schema.parse(input);
  const barriers = legacy.barriers.map((control, index) => ({
    ...control,
    referenceId: `C-${String(index + 1).padStart(3, "0")}`,
  }));
  return mapDataV4Schema.parse({
    schemaVersion: 4,
    metadata: {
      ...(legacy.metadata ?? {}),
      controlReferenceHighWaterMark: Math.max(
        legacy.barriers.length,
        ...barriers.map((control) => referenceNumber(control.referenceId, "C")),
      ),
      attachmentReferenceHighWaterMark: 0,
      contextItems: (legacy.metadata?.contextItems ?? []).map((item) => ({
        ...item,
        displayMode: "Text",
      })),
    },
    nodes: legacy.nodes.map((node) => ({
      ...node,
      ...(node.nodeType === "Event" ? { eventDisplay: "Map" as const } : {}),
      contextItems: node.contextItems.map((item) => ({
        ...item,
        displayMode: "Text" as const,
      })),
    })),
    edges: legacy.edges,
    barriers,
    evidence: legacy.evidence.map((item) => ({ ...item, attachmentIds: [] })),
    attachments: [],
  });
};

const migratedContextId = (
  nodeId: string,
  effect: "Mitigating" | "Aggravating",
  sourceIndex: number,
  used: Set<string>,
): string => {
  const safeNode = encodeURIComponent(nodeId);
  const base = `context-${safeNode}-${effect.toLowerCase()}-${sourceIndex}`;
  let id = base;
  let collision = 2;
  while (used.has(id)) id = `${base}-${collision++}`;
  used.add(id);
  return id;
};

export const migrateMapDataV4 = (input: unknown): MapData => {
  const legacy = mapDataV4Schema.parse(input);
  const usedContextIds = new Set([
    ...(legacy.metadata?.contextItems ?? []).map((item) => item.id),
    ...legacy.nodes.flatMap((node) => node.contextItems.map((item) => item.id)),
  ]);
  return validate({
    ...legacy,
    schemaVersion: 5,
    metadata: legacy.metadata && {
      ...legacy.metadata,
      contextItems: legacy.metadata.contextItems.map((item) => ({
        ...item,
        effect: "Neutral" as const,
      })),
    },
    nodes: legacy.nodes.map(
      ({
        positiveConsequenceBulletPoints: positive,
        negativeConsequenceBulletPoints: negative,
        ...node
      }) => {
        const migrate = (
          values: string[],
          effect: "Mitigating" | "Aggravating",
          label: string,
        ) =>
          values.flatMap((value, sourceIndex) =>
            value.trim()
              ? [
                  {
                    id: migratedContextId(
                      node.id,
                      effect,
                      sourceIndex,
                      usedContextIds,
                    ),
                    label,
                    value,
                    effect,
                    displayMode: "Text" as const,
                    showOnCard: true,
                  },
                ]
              : [],
          );
        return {
          ...node,
          contextItems: [
            ...node.contextItems.map((item) => ({
              ...item,
              effect: "Neutral" as const,
            })),
            ...migrate(positive, "Mitigating", "Mitigating context"),
            ...migrate(negative, "Aggravating", "Aggravating context"),
          ],
        };
      },
    ),
  });
};

export const migrateMapDataV3 = (input: unknown): MapData =>
  migrateMapDataV4(migrateMapDataV3ToV4(input));

export const migrateMapDataV1 = (input: unknown): MapData =>
  migrateMapDataV3(migrateMapDataV1ToV3(input));

/** The sole boundary for untrusted persisted map JSON. */
export const parseAndMigrateMapData = (input: unknown): MapData => {
  const { schemaVersion } = versionEnvelope.parse(input);
  if (schemaVersion === 1) return migrateMapDataV1(input);
  if (schemaVersion === 2) {
    const canonical = mapDataV2Schema.safeParse(input);
    return migrateMapDataV3(
      migrateV2(canonical.success ? canonical.data : parseLegacyV2(input)),
    );
  }
  if (schemaVersion === 3) return migrateMapDataV3(input);
  if (schemaVersion === 4) return migrateMapDataV4(input);
  if (schemaVersion === 5) return validate(input);
  throw new Error(`Unsupported map schema version: ${schemaVersion}`);
};
