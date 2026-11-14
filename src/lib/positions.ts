/**
 * Fractional ordering: a card's position is a number between its neighbours,
 * so moving one card writes one row instead of renumbering the whole column.
 */
export const STEP = 1000;

export function between(before: number | undefined, after: number | undefined) {
  if (before === undefined && after === undefined) return STEP;
  if (before === undefined) return after! - STEP;
  if (after === undefined) return before + STEP;
  return (before + after) / 2;
}

/** True when neighbours are so close that a midpoint would lose precision. */
export function tooClose(before: number | undefined, after: number | undefined) {
  return before !== undefined && after !== undefined && Math.abs(after - before) < 1e-6;
}

export const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
