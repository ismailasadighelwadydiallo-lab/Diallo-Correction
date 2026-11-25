// Détection des 4 repères noirs. Repris tel quel de correcteur.html (seuil adaptatif
// par image intégrale, composantes connexes, filtre forme/remplissage).

/** Image en niveaux de gris : un octet par pixel, ligne par ligne. */
export interface GrayImage {
  data: Uint8Array;
  width: number;
  height: number;
}

/** Renvoie les centres des repères [HG, HD, BG, BD] en pixels, ou null. */
export function findMarkers(g: Uint8Array, w: number, h: number): [number, number][] | null {
  const N = w * h;
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) {
      s += g[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + s;
    }
  }
  const r = Math.round(Math.max(w, h) / 10);
  const bin = new Uint8Array(N);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r);
      const m = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      bin[y * w + x] = g[y * w + x] < m * 0.72 && g[y * w + x] < 150 ? 1 : 0;
    }
  }
  const lab = new Uint8Array(N), st = new Int32Array(N);
  const md = Math.min(w, h), mn = md * 0.018, mx = md * 0.14;
  const cands: { x: number; y: number; s: number; fill: number }[] = [];
  for (let i = 0; i < N; i++) {
    if (!bin[i] || lab[i]) continue;
    let sp = 0;
    st[sp++] = i;
    lab[i] = 1;
    let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, sx = 0, sy = 0;
    while (sp) {
      const p = st[--sp], x = p % w, y = (p / w) | 0;
      n++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && bin[p - 1] && !lab[p - 1]) { lab[p - 1] = 1; st[sp++] = p - 1; }
      if (x < w - 1 && bin[p + 1] && !lab[p + 1]) { lab[p + 1] = 1; st[sp++] = p + 1; }
      if (y > 0 && bin[p - w] && !lab[p - w]) { lab[p - w] = 1; st[sp++] = p - w; }
      if (y < h - 1 && bin[p + w] && !lab[p + w]) { lab[p + w] = 1; st[sp++] = p + w; }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, fill = n / (bw * bh), asp = bw / bh;
    if (bw > mn && bh > mn && bw < mx && bh < mx && fill > 0.62 && asp > 0.6 && asp < 1.65)
      cands.push({ x: sx / n, y: sy / n, s: Math.sqrt(n), fill });
  }
  // On garde en priorité les candidats bien remplis (carrés).
  const sq = cands.filter((c) => c.fill > 0.85);
  const pool = sq.length >= 4 ? sq : cands;
  if (pool.length < 4) return null;
  const pick = (f: (c: (typeof pool)[number]) => number) => pool.reduce((b, c) => (f(c) > f(b) ? c : b));
  const m = [pick((c) => -c.x - c.y), pick((c) => c.x - c.y), pick((c) => c.y - c.x), pick((c) => c.x + c.y)];
  if (new Set(m).size < 4) return null;
  return m.map((c) => [c.x, c.y]);
}

/** Conversion RGBA → gris (mêmes coefficients que correcteur.html). */
export function rgbaToGray(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = (rgba[i * 4] * 0.3 + rgba[i * 4 + 1] * 0.59 + rgba[i * 4 + 2] * 0.11) | 0;
  return g;
}
