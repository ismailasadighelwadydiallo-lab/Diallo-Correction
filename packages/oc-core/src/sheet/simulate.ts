// Simulateur de photos de feuilles-réponses, pour les tests automatiques.
// Il dessine la feuille idéale puis applique perspective, éclairage inégal, ombre, bruit.
import { homography, MK, MARKER_SIZE, W, H, type Point } from './geometry.ts';
import { layout, type ItemFeuille } from './layout.ts';

export interface MarqueSimulee {
  /** étiquettes noircies */
  labels: string[];
  /** gris du trait : 30 = stylo noir, 150-170 = crayon pâle */
  gris?: number;
  /** proportion de la case couverte (0-1), défaut 0,85 */
  couverture?: number;
}

export interface OptionsSimulation {
  largeur: number;
  hauteur: number;
  /** Position dans l'image des centres des 4 repères [HG, HD, BG, BD]. */
  coins: [Point, Point, Point, Point];
  /** Gris du papier (défaut 235) et du fond de la table (défaut 175). */
  papier?: number;
  fond?: number;
  /** Éclairage : facteur multiplicatif en haut-gauche et en bas-droite (dégradé linéaire). */
  eclairage?: [number, number];
  /** Ombre : demi-plan a·x + b·y > c (coordonnées image) assombri par `facteur`. */
  ombre?: { a: number; b: number; c: number; facteur: number; douceur?: number };
  /** Amplitude du bruit (± gris), défaut 6. */
  bruit?: number;
  /** Graine du bruit. */
  graine?: number;
}

function hash(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function simulerFeuille(items: ItemFeuille[], marques: Record<string, MarqueSimulee>, o: OptionsSimulation): Uint8Array {
  const { largeur: w, hauteur: h } = o;
  const papier = o.papier ?? 235, fond = o.fond ?? 175, bruit = o.bruit ?? 6, graine = o.graine ?? 1;
  const inv = homography(o.coins, MK); // image → feuille
  const L = layout(items);
  // index des cases par ligne pour accélérer
  const lignes = L.map((q, i) => ({ y: q.y, bulles: q.bubbles, m: marques[items[i].id] }));
  const half = MARKER_SIZE / 2;
  const g = new Uint8Array(w * h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const [sx, sy] = inv(px + 0.5, py + 0.5);
      let v: number;
      if (sx < 0 || sy < 0 || sx > W || sy > H) v = fond;
      else {
        v = papier;
        for (const [mx, my] of MK) if (Math.abs(sx - mx) <= half && Math.abs(sy - my) <= half) v = 20;
        if (sy >= 299 && sy <= 301 && sx >= 95 && sx <= 905) v = 40;
        // lignes de texte de l'en-tête (approximation : bandes tramées)
        if (((sy > 100 && sy < 130) || (sy > 205 && sy < 228) || (sy > 260 && sy < 278)) && sx > 95 && sx < 905 && (Math.floor(sx / 4) + Math.floor(sy / 5)) % 3 === 0) v = 70;
        for (const l of lignes) {
          if (Math.abs(sy - l.y) > 22) continue;
          // numéro de question
          if (sx >= l.bulles[0].x - 75 && sx <= l.bulles[0].x - 50 && Math.abs(sy - l.y) < 9 && Math.floor(sx / 3) % 2 === 0) v = 50;
          for (const b of l.bulles) {
            const d = Math.hypot(sx - b.x, sy - b.y);
            if (d > 20) continue;
            if (Math.abs(d - 18) <= 1.3) v = Math.min(v, 40);
            // lettre imprimée en gris clair au centre de la case
            if (Math.abs(sx - b.x) < 5 && Math.abs(sy - b.y) < 7 && (Math.floor(sx) + Math.floor(sy)) % 3 === 0) v = Math.min(v, 170);
            if (l.m && l.m.labels.includes(b.l) && d <= 15.5 && hash(Math.round(sx * 2), Math.round(sy * 2), graine) < (l.m.couverture ?? 0.85)) v = Math.min(v, l.m.gris ?? 30);
          }
        }
      }
      // éclairage
      if (o.eclairage) {
        const t = (px / w + py / h) / 2;
        v *= o.eclairage[0] + (o.eclairage[1] - o.eclairage[0]) * t;
      }
      if (o.ombre) {
        // transition progressive sur `douceur` pixels (les ombres réelles ont un bord flou)
        const d = (o.ombre.a * px + o.ombre.b * py - o.ombre.c) / Math.hypot(o.ombre.a, o.ombre.b);
        const t = Math.max(0, Math.min(1, d / (o.ombre.douceur ?? 1) + 0.5));
        v *= 1 - t * (1 - o.ombre.facteur);
      }
      v += (hash(px, py, graine + 7) - 0.5) * 2 * bruit;
      g[py * w + px] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return g;
}

/** Coins d'une feuille droite, centrée, occupant `echelle` de l'image. */
export function coinsDroits(w: number, h: number, echelle = 0.9): [Point, Point, Point, Point] {
  const s = Math.min((w * echelle) / W, (h * echelle) / H);
  const ox = (w - W * s) / 2, oy = (h - H * s) / 2;
  return MK.map(([x, y]) => [ox + x * s, oy + y * s] as Point) as [Point, Point, Point, Point];
}
