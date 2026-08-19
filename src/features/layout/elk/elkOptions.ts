/**
 * ELK's string options are kept here so the adapter has one auditable policy.
 * The interactive strategy deliberately favours repeatability over incremental
 * freedom: array order is significant and ports cannot migrate between sides.
 */
export const ELK_LAYERED_OPTIONS: Readonly<Record<string, string>> = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.portConstraints": "FIXED_SIDE",
  "elk.layered.considerModelOrder.strategy": "PREFER_NODES",
  "elk.layered.cycleBreaking.strategy": "MODEL_ORDER",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.nodePlacement.favorStraightEdges": "true",
  "elk.layered.thoroughness": "20",
  "elk.randomSeed": "1",
};

export const elkSpacingOptions = (horizontal: number, vertical: number) => ({
  "elk.spacing.nodeNode": String(horizontal),
  "elk.layered.spacing.nodeNodeBetweenLayers": String(vertical),
  "elk.layered.spacing.edgeNodeBetweenLayers": String(vertical / 2),
});
