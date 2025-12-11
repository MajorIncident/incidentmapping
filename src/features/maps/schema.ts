import { z } from "zod";

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const chainNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("ChainNode"),
  title: z.string().min(1, "ChainNode title is required"),
  description: z.string().optional(),
  owner: z.string().optional(),
  timestamp: z.string().optional(),
  positiveConsequenceBulletPoints: z.array(z.string()).default([]),
  negativeConsequenceBulletPoints: z.array(z.string()).default([]),
  position: positionSchema,
});

export const causeEffectEdgeSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("CauseEffectEdge"),
  fromId: z.string().min(1),
  toId: z.string().min(1),
});

export const barrierSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("Barrier"),
  upstreamNodeId: z.string().min(1),
  downstreamNodeId: z.string().min(1),
  breached: z.boolean(),
  breachedItems: z.array(z.string()).default([]),
});

export const metadataSchema = z
  .object({
    title: z.string().optional(),
  })
  .optional();

export const mapDataSchema = z.object({
  schemaVersion: z.literal(1),
  metadata: metadataSchema,
  nodes: z.array(chainNodeSchema),
  edges: z.array(causeEffectEdgeSchema),
  barriers: z.array(barrierSchema).default([]),
});

export type MapData = z.infer<typeof mapDataSchema>;
export type ChainNode = z.infer<typeof chainNodeSchema>;
export type CauseEffectEdge = z.infer<typeof causeEffectEdgeSchema>;
export type Barrier = z.infer<typeof barrierSchema>;
