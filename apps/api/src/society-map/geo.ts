/*
 * The arithmetic behind laying a scanned society map onto the real map.
 *
 * Web Mercator (EPSG:3857) is the projection every web map draws in, and in it
 * a scan of a master plan is, to within the accuracy of the drawing, an affine
 * image of the ground: moved, turned, scaled, perhaps a little skewed. So three
 * or more matched points (a pixel on the scan ↔ the same spot on the
 * satellite) fix the transform, by least squares when there are more than
 * three, and the leftover distance at each point says how good the match is.
 *
 * The dashboard has a copy of these functions (lib/society-geo.ts) for its
 * live preview; keep the two in step.
 */

export const R = 6378137;
export const HALF = Math.PI * R; // half the world's width in mercator metres

export function toMerc(lat: number, lng: number): [number, number] {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const x = (lng * Math.PI * R) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
  return [x, y];
}

export function fromMerc(x: number, y: number): [number, number] {
  const lng = (x / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return [lat, lng];
}

/** [a, b, c, d, e, f]: x = a·u + b·v + c, y = d·u + e·v + f (mercator metres from image pixels). */
export type Affine = [number, number, number, number, number, number];

export interface GeoPoint {
  px: number;
  py: number;
  lat: number;
  lng: number;
}

function solve3(m: number[][], r: number[]): [number, number, number] | null {
  // Cramer's rule — the system is only ever 3×3.
  const det = (k: number[][]) =>
    k[0]![0]! * (k[1]![1]! * k[2]![2]! - k[1]![2]! * k[2]![1]!) -
    k[0]![1]! * (k[1]![0]! * k[2]![2]! - k[1]![2]! * k[2]![0]!) +
    k[0]![2]! * (k[1]![0]! * k[2]![1]! - k[1]![1]! * k[2]![0]!);
  const d = det(m);
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12) return null;
  const col = (i: number) => m.map((row, j) => row.map((v, k) => (k === i ? r[j]! : v)));
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d];
}

/** Least-squares affine fit. Null with fewer than three points or when they lie on a line. */
export function fitAffine(points: GeoPoint[]): Affine | null {
  if (points.length < 3) return null;
  // Centre the pixel coordinates first: keeps the normal equations well conditioned.
  const n = points.length;
  const mu = points.reduce((s, p) => s + p.px, 0) / n;
  const mv = points.reduce((s, p) => s + p.py, 0) / n;
  let suu = 0, suv = 0, svv = 0;
  let sx = 0, sy = 0, sux = 0, svx = 0, suy = 0, svy = 0;
  for (const p of points) {
    const u = p.px - mu;
    const v = p.py - mv;
    const [x, y] = toMerc(p.lat, p.lng);
    suu += u * u; suv += u * v; svv += v * v;
    sx += x; sy += y;
    sux += u * x; svx += v * x; suy += u * y; svy += v * y;
  }
  const M = [
    [suu, suv, 0],
    [suv, svv, 0],
    [0, 0, n],
  ];
  const X = solve3(M, [sux, svx, sx]);
  const Y = solve3(M, [suy, svy, sy]);
  if (!X || !Y) return null;
  const [a, b, c0] = X;
  const [d, e, f0] = Y;
  // Undo the centring.
  return [a, b, c0 - a * mu - b * mv, d, e, f0 - d * mu - e * mv];
}

export function applyAffine(t: Affine, u: number, v: number): [number, number] {
  return [t[0] * u + t[1] * v + t[2], t[3] * u + t[4] * v + t[5]];
}

/** Ground distance in metres between where each point was put and where the fit puts it. */
export function residuals(t: Affine, points: GeoPoint[]): number[] {
  return points.map((p) => {
    const [x, y] = applyAffine(t, p.px, p.py);
    const [tx, ty] = toMerc(p.lat, p.lng);
    // Mercator metres stretch by 1/cos(lat); scale back to metres on the ground.
    return Math.hypot(x - tx, y - ty) * Math.cos((p.lat * Math.PI) / 180);
  });
}

/** Image corners on the ground: tl, tr, br, bl, as [lat, lng]. */
export function cornersOf(t: Affine, width: number, height: number): number[][] {
  return [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ].map(([u, v]) => {
    const [x, y] = applyAffine(t, u!, v!);
    return fromMerc(x, y);
  });
}

/** Size of one mercator pixel at zoom z, in mercator metres. */
export function mercPixel(z: number): number {
  return (2 * HALF) / (256 * 2 ** z);
}
