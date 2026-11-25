// Statistiques de classe et export CSV.
import type { Pack } from './pack/types.ts';
import { exerciceDe } from './pack/validate.ts';
import type { Resultat } from './grading/types.ts';

export interface Statistiques {
  n: number;
  moyenne: number;
  mediane: number;
  min: number;
  max: number;
  /** Taux de réussite (points obtenus / points possibles) par exercice, 0 à 1. */
  parExercice: { exercice: string; reussite: number }[];
  parQuestion: { question: string; reussite: number }[];
  douteuses: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function statistiques(pack: Pack, resultats: Resultat[]): Statistiques {
  const notes = resultats.map((r) => r.sur20).sort((a, b) => a - b);
  const n = notes.length;
  const mediane = n ? (n % 2 ? notes[(n - 1) / 2] : (notes[n / 2 - 1] + notes[n / 2]) / 2) : 0;
  const exercices = [...new Set(pack.questions.map(exerciceDe))];
  const reussite = (filtre: (id: string) => boolean) => {
    let obt = 0, pos = 0;
    for (const r of resultats) for (const q of r.questions) if (filtre(q.id)) { obt += Math.max(0, q.points); pos += q.max; }
    return pos ? r2(obt / pos) : 0;
  };
  const exDe = new Map(pack.questions.map((q) => [q.id, exerciceDe(q)]));
  return {
    n,
    moyenne: n ? r2(notes.reduce((a, b) => a + b, 0) / n) : 0,
    mediane: r2(mediane),
    min: n ? notes[0] : 0,
    max: n ? notes[n - 1] : 0,
    parExercice: exercices.map((e) => ({ exercice: e, reussite: reussite((id) => exDe.get(id) === e) })),
    parQuestion: pack.questions.map((q) => ({ question: q.id, reussite: reussite((id) => id === q.id) })),
    douteuses: resultats.filter((r) => r.douteuse).length,
  };
}

/** CSV séparé par « ; » avec BOM (ouvre correctement dans Excel en français). */
export function exporterCsv(pack: Pack, lignes: { eleve: string; resultat: Resultat }[]): string {
  const f = (x: number) => String(r2(x)).replace('.', ',');
  const rows: (string | number)[][] = [['Élève', ...pack.questions.map((q) => q.id), 'Points', 'Total', 'Note /20', 'À revoir', 'Modifiée']];
  for (const { eleve, resultat: r } of lignes) {
    rows.push([
      eleve,
      ...pack.questions.map((q) => f(r.questions.find((x) => x.id === q.id)?.points ?? 0)),
      f(r.note), f(r.total), f(r.sur20),
      r.douteuse ? 'oui' : '', r.modifications.length ? 'oui' : '',
    ]);
  }
  return '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
}
