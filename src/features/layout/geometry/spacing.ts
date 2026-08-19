/** Shared geometry policy. Keep layout engines and renderers on the same grid. */
/** Minimum clear corridor for an aligned, unobstructed one-to-one edge. */
export const DIRECT_CAUSAL_EDGE_GAP = 32;
/** Minimum corridor in which a branch or merge rail can be routed. */
export const BRANCH_MERGE_RAIL_GAP = 64;
/** Minimum complete interval between cards when it contains a Control. */
export const CONTROL_BEARING_INTERVAL = 248;
/** Collision clearance between independent card rectangles. */
export const CARD_COLLISION_CLEARANCE = 32;

/** @deprecated Prefer the invariant which describes the interval. */
export const CAUSAL_ROW_GAP = BRANCH_MERGE_RAIL_GAP;
/** @deprecated Control spacing is expressed as a complete interval. */
export const CONTROL_BAND_HEIGHT =
  CONTROL_BEARING_INTERVAL - BRANCH_MERGE_RAIL_GAP;
export const SIBLING_GAP = 32;
export const SUBTREE_GAP = 96;
export const ACTION_GUTTER = 64;
export const ACTION_GAP = 24;
/** Candidate search policy for local Action sidecars. */
export const ACTION_VERTICAL_SEARCH_STEP = 24;
export const MAX_ACTION_VERTICAL_OFFSET = 72;
/** Roughly one and a half standard semantic cards; prevents runaway width. */
export const MAX_ACTION_INDUCED_BRANCH_SHIFT = 360;
/** Centralized, intentionally simple Action-aware layout cost weights. */
export const ACTION_DISTANCE_WEIGHT = 8;
export const ACTION_ROUTE_WEIGHT = 2;
export const CAUSAL_WIDTH_WEIGHT = 1;
export const BRANCH_MOVEMENT_WEIGHT = 0.08;
export const CROSSING_WEIGHT = 2_000;
export const EDGE_STUB = 12;
export const BRANCH_RAIL_GAP = 10;
export const MERGE_RAIL_GAP = 10;
export const OBJECT_CLEARANCE = CARD_COLLISION_CLEARANCE;
export const CHRONOLOGY_GUTTER = 96;

/**
 * Extra height reserved immediately before a semantic rank containing Controls.
 * The default keeps the established visual band, while measured tall Controls
 * can enlarge it enough to retain the shared object clearance.
 */
export const requiredRankInterval = (
  requiresRail: boolean,
  incomingControlHeights: readonly number[],
): number =>
  incomingControlHeights.length
    ? Math.max(
        CONTROL_BEARING_INTERVAL,
        Math.max(...incomingControlHeights) + 2 * CARD_COLLISION_CLEARANCE,
      )
    : requiresRail
      ? BRANCH_MERGE_RAIL_GAP
      : DIRECT_CAUSAL_EDGE_GAP;

/** Legacy additive form used by callers with a fixed rail-sized base gap. */
export const requiredControlBandForNextRank = (
  incomingControlHeights: readonly number[],
): number =>
  requiredRankInterval(true, incomingControlHeights) - BRANCH_MERGE_RAIL_GAP;
