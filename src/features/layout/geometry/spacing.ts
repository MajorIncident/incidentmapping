/** Shared geometry policy. Keep layout engines and renderers on the same grid. */
export const CAUSAL_ROW_GAP = 64;
export const CONTROL_BAND_HEIGHT = 184;
export const SIBLING_GAP = 32;
export const SUBTREE_GAP = 96;
export const ACTION_GUTTER = 64;
export const ACTION_GAP = 24;
export const EDGE_STUB = 12;
export const BRANCH_RAIL_GAP = 10;
export const MERGE_RAIL_GAP = 10;
export const OBJECT_CLEARANCE = 32;
export const CHRONOLOGY_GUTTER = 96;

/**
 * Extra height reserved immediately before a semantic rank containing Controls.
 * The default keeps the established visual band, while measured tall Controls
 * can enlarge it enough to retain the shared object clearance.
 */
export const requiredControlBandForNextRank = (
  incomingControlHeights: readonly number[],
): number =>
  incomingControlHeights.length
    ? Math.max(
        CONTROL_BAND_HEIGHT,
        Math.max(...incomingControlHeights) + OBJECT_CLEARANCE,
      )
    : 0;
