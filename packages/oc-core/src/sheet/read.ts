// Lecture d'une feuille photographiée (reprise de readSheet de correcteur.html),
// étendue aux QCM à plusieurs réponses et avec un indice de confiance par ligne.
import { homography, MK, type Transform } from './geometry.ts';
import { findMarkers } from './markers.ts';
import { layout, type ItemFeuille, type LigneFeuille } from './layout.ts';
import type { Copie, Lecture } from '../grading/types.ts';

/** Seuil maximal de noirceur relative à partir duquel une case est « cochée » (il s'abaisse pour le crayon pâle). */
export const SEUIL = 0.2;

export interface LectureLigne {
  id: string;
  marques: string[];
  statut: 'ok' | 'vide' | 'multiple' | 'incertain';
  confiance: number;
  /** Noirceur relative de chaque case (0 = blanche). */
  scores: number[];
  /** Position de chaque case dans l'image (pour l'affichage). */
  positions: [number, number][];
}

export type ResultatLecture =
  | { ok: true; lignes: LectureLigne[]; reperes: [number, number][]; rayon: number; T: Transform; L: LigneFeuille[]; seuil: number }
  | { ok: false; erreur: string };

export function readSheet(g: Uint8Array, w: number, h: number, items: ItemFeuille[]): ResultatLecture {
  const mk = findMarkers(g, w, h);
  if (!mk) return { ok: false, erreur: "Les 4 carrés noirs des coins n'ont pas été trouvés." };
  const T = homography(MK, mk);
  const L = layout(items);
  const at = (u: number, v: number) => {
    const x = Math.round(u), y = Math.round(v);
    return x < 0 || y < 0 || x >= w || y >= h ? 255 : g[y * w + x];
  };
  const pts: [number, number][] = [];
  for (let dx = -10; dx <= 10; dx += 2.5) for (let dy = -10; dy <= 10; dy += 2.5) if (dx * dx + dy * dy <= 105) pts.push([dx, dy]);
  // Noirceur de chaque case, relative au papier juste autour d'elle (anneau de rayon 26) :
  // cela compense les ombres et l'éclairage inégal, qui varient d'un endroit à l'autre.
  const anneau: [number, number][] = [];
  for (let k = 0; k < 16; k++) anneau.push([26 * Math.cos((k * Math.PI) / 8), 26 * Math.sin((k * Math.PI) / 8)]);
  const brut: number[][] = L.map((q) =>
    q.bubbles.map((b) => {
      let s = 0;
      for (const [dx, dy] of pts) {
        const [u, v] = T(b.x + dx, b.y + dy);
        s += at(u, v);
      }
      const dedans = s / pts.length;
      const autour = anneau.map(([dx, dy]) => { const [u, v] = T(b.x + dx, b.y + dy); return at(u, v); }).sort((a, c) => a - c);
      const papier = Math.max(1, (autour[7] + autour[8]) / 2); // médiane : suit un dégradé d'ombre
      return (papier - dedans) / papier;
    }),
  );
  // Référence « case blanche » : 40e centile de toutes les cases (la plupart sont vides).
  const tri = brut.flat().sort((a, b) => a - b);
  const blanc = tri[Math.floor(tri.length * 0.4)] ?? 0;
  const scores = brut.map((r) => r.map((s) => s - blanc));
  // Seuil adaptatif : la moitié de la noirceur typique d'une case cochée (crayon pâle → seuil plus bas),
  // borné entre 0,08 et SEUIL.
  const maxima = scores.map((r) => Math.max(...r)).filter((s) => s > 0.08).sort((a, b) => a - b);
  const typique = maxima.length ? maxima[Math.floor(maxima.length / 2)] : SEUIL * 2;
  const seuil = Math.min(SEUIL, Math.max(0.08, typique * 0.5));
  const lignes: LectureLigne[] = L.map((q, i) => {
    const it = items[i];
    const sc = scores[i];
    const ordre = sc.map((s, k) => [s, k] as const).sort((a, b) => b[0] - a[0]);
    const [s1, i1] = ordre[0];
    const s2 = ordre[1] ? ordre[1][0] : 0;
    // confiance : distance de chaque case au seuil (0,1 de marge = certitude complète)
    let conf = Math.min(1, ...sc.map((s) => Math.abs(s - seuil) / (seuil * 0.5)));
    let statut: LectureLigne['statut'];
    let marques: string[];
    if (s1 < seuil) {
      statut = 'vide';
      marques = [];
    } else if (it.multi) {
      marques = ordre.filter(([s]) => s > seuil && s > s1 * 0.45).map(([, k]) => q.labels[k]).sort();
      statut = 'ok';
    } else if (s2 > seuil && s2 > s1 * 0.7) {
      statut = 'multiple';
      marques = ordre.filter(([s]) => s > seuil && s > s1 * 0.7).map(([, k]) => q.labels[k]).sort();
    } else {
      statut = 'ok';
      marques = [q.labels[i1]];
      // deuxième case presque aussi noire que la première : moins sûr
      if (s2 > seuil) conf = Math.min(conf, Math.max(0, (s1 * 0.7 - s2) / (s1 * 0.3)));
    }
    conf = Math.round(conf * 100) / 100;
    if (statut === 'ok' && conf < 0.5) statut = 'incertain';
    return { id: it.id, marques, statut, confiance: conf, scores: sc.map((s) => Math.round(s * 1000) / 1000), positions: q.bubbles.map((b) => T(b.x, b.y)) };
  });
  const [ru] = T(80, 0), [ru2] = T(98, 0);
  return { ok: true, lignes, reperes: mk, rayon: Math.abs(ru2 - ru), T, L, seuil: Math.round(seuil * 1000) / 1000 };
}

/** Transforme la lecture d'une feuille en copie à noter. */
export function copieDepuisLecture(items: ItemFeuille[], lignes: LectureLigne[], eleve?: string): Copie {
  const reponses: Copie['reponses'] = {};
  items.forEach((it, i) => {
    const l = lignes[i];
    const lecture: Lecture = { confiance: l.confiance, statut: l.statut };
    if (it.type === 'choix') reponses[it.id] = { choix: l.marques, lecture };
    else {
      // cases de points : en cas de doute (plusieurs cases), on garde la plus petite valeur et on signale
      const vals = l.marques.map((m) => it.valeurs![it.labels.indexOf(m)]);
      reponses[it.id] = { points: vals.length ? Math.min(...vals) : 0, lecture };
    }
  });
  return { eleve, reponses };
}
