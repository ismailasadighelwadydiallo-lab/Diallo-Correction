// Mise en page de la feuille-réponse (reprise de correcteur.html, étendue aux packs).
import type { Pack } from '../pack/types.ts';

/** Nombre maximal de questions sur une feuille (2 colonnes de 20, comme correcteur.html). */
export const MAX_QUESTIONS = 40;
/** Nombre maximal de cases par ligne (au-delà on sortirait de la zone imprimable). */
export const MAX_CASES = 6;

export interface ItemFeuille {
  /** id de la question du pack */
  id: string;
  numero: number;
  /** `choix` = lettres d'un QCM ; `points` = l'enseignant noircit les points obtenus. */
  type: 'choix' | 'points';
  labels: string[];
  /** Pour `points` : valeur de chaque case. */
  valeurs?: number[];
  /** QCM à plusieurs bonnes réponses : plusieurs cases peuvent être noircies. */
  multi: boolean;
}

export interface Bulle { x: number; y: number; l: string }
export interface LigneFeuille { x0: number; y: number; labels: string[]; bubbles: Bulle[] }

const fmt = (n: number) => String(n).replace('.', ',');

/** Valeurs des cases de points pour une question notée sur `max` (pas de 0,25 si possible). */
export function casesPoints(max: number): number[] {
  let pas = [0.25, 0.5, 1].find((p) => max / p + 1 <= MAX_CASES);
  if (pas === undefined) pas = Math.ceil((max / (MAX_CASES - 1)) * 4) / 4;
  const v: number[] = [];
  for (let k = 0; k * pas < max - 1e-9 && v.length < MAX_CASES - 1; k++) v.push(Math.round(k * pas * 100) / 100);
  v.push(max);
  return v;
}

/** Construit la liste des lignes de la feuille à partir d'un pack. */
export function specFeuille(pack: Pack): ItemFeuille[] {
  if (pack.questions.length > MAX_QUESTIONS) throw new Error(`Une feuille contient au plus ${MAX_QUESTIONS} questions (${pack.questions.length} dans ce pack).`);
  return pack.questions.map((q, i) => {
    if (q.type === 'qcm') {
      if (q.choix.length > MAX_CASES) throw new Error(`${q.id} : au plus ${MAX_CASES} choix sur la feuille.`);
      return { id: q.id, numero: i + 1, type: 'choix', labels: q.choix.slice(), multi: q.bonnes.length > 1 };
    }
    const valeurs = casesPoints(q.points);
    return { id: q.id, numero: i + 1, type: 'points', labels: valeurs.map(fmt), valeurs, multi: false };
  });
}

/** Position des cases (repère logique 1000 × 1414). Identique à correcteur.html. */
export function layout(items: ItemFeuille[]): LigneFeuille[] {
  return items.map((it, i) => {
    const col = i < 20 ? 0 : 1, row = i % 20, x0 = col ? 545 : 95, y = 345 + row * 50;
    return { x0, y, labels: it.labels, bubbles: it.labels.map((l, k) => ({ x: x0 + 75 + k * 58, y, l })) };
  });
}
