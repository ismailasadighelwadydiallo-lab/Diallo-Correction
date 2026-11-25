// Géométrie de la feuille-réponse. Repris de correcteur.html (W, H, MK, solve, homography).

/** Dimensions de la feuille dans son repère logique (proportions A4). */
export const W = 1000;
export const H = 1414;
/** Centres des 4 repères (carrés noirs de 60 unités) : haut-gauche, haut-droit, bas-gauche, bas-droit. */
export const MK: ReadonlyArray<readonly [number, number]> = [
  [50, 50],
  [950, 50],
  [50, 1364],
  [950, 1364],
];
export const MARKER_SIZE = 60;

export type Point = readonly [number, number];
export type Transform = (x: number, y: number) => [number, number];

/** Résout un système linéaire (matrice augmentée n×(n+1)) par pivot de Gauss. */
export function solve(A: number[][]): number[] {
  const n = A.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((r, i) => r[n] / r[i]);
}

/** Homographie qui envoie les 4 points `src` sur les 4 points `dst`. */
export function homography(src: ReadonlyArray<Point>, dst: ReadonlyArray<Point>): Transform {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
  }
  const h = solve(A);
  return (x, y) => {
    const d = h[6] * x + h[7] * y + 1;
    return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
  };
}
