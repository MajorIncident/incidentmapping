import { z } from "zod";
import { mapDataSchema, mapDataV1Schema, type MapData } from "./schema";

const versionEnvelope = z.object({ schemaVersion: z.number() });

export const migrateMapDataV1 = (input: unknown): MapData => {
  const legacy = mapDataV1Schema.parse(input);
  return mapDataSchema.parse({
    schemaVersion: 2,
    metadata: {
      ...legacy.metadata,
      nodeReferenceHighWaterMark: legacy.nodes.length,
    },
    nodes: legacy.nodes.map((node, index) => ({
      ...node,
      referenceId: `N-${String(index + 1).padStart(3, "0")}`,
      nodeType: "Event",
      evidenceItems: [],
      evidenceHighWaterMark: 0,
    })),
    edges: legacy.edges,
    barriers: legacy.barriers.map(({ breached, breachedItems, ...barrier }) => {
      const details = breachedItems
        .filter((item) => item.length > 0)
        .join("\n");
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
  if (schemaVersion === 2) return mapDataSchema.parse(input);
  throw new Error(`Unsupported map schema version: ${schemaVersion}`);
};
