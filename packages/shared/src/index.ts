let counter = 0;
/** Deterministic-ish unique id with a readable prefix. */
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Snap a coordinate to a grid (default 10 units, the editor grid). */
export const snap = (v: number, grid = 10) => Math.round(v / grid) * grid;
export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };
