import type { Rectangle } from "../layoutModel";

type HorizontalGeometry = Pick<Rectangle, "x" | "width">;

/** Exact horizontal center shared by both layout implementations. */
export const centerX = (geometry: HorizontalGeometry): number =>
  geometry.x + geometry.width / 2;

/** Translation required to put `moving` on the same vertical lane as `fixed`. */
export const centerAlignmentDelta = (
  fixed: HorizontalGeometry,
  moving: HorizontalGeometry,
): number => centerX(fixed) - centerX(moving);

export const rectanglesOverlap = (
  left: Rectangle,
  right: Rectangle,
  clearance = 0,
): boolean =>
  left.x < right.x + right.width + clearance &&
  left.x + left.width + clearance > right.x &&
  left.y < right.y + right.height + clearance &&
  left.y + left.height + clearance > right.y;
