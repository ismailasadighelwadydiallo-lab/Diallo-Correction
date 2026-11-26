// Découpage des VRAIS sujets du Bac 2026 (texte lu par OCR sur les photos de l'enseignant).
// Seuils = mesure du 26/11/2026 : le test échoue si une modification fait reculer le découpage.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decouperSujet, corrigerFormulesOcr } from '../src/index.ts';

const D = new URL('../../../fixtures/sujets/reels/', import.meta.url);
const lire = (f: string) => readFileSync(new URL(f, D), 'utf8');
const verite: Record<string, Record<string, Record<string, number>>> = JSON.parse(lire('verite.json'));

function mesurer(nom: string) {
  const d = decouperSujet(corrigerFormulesOcr(lire(`ocr-${nom}.txt`)));
  let n = 0, trouvees = 0, points = 0;
  for (const [ex, qs] of Object.entries(verite[nom])) {
    const e = d.exercices.find((x) => x.titre === ex);
    for (const [id, pts] of Object.entries(qs)) {
      n++;
      const q = e?.questions.find((x) => x.id === id);
      if (q) { trouvees++; if (q.points === pts) points++; }
    }
  }
  return { n, trouvees, points, d };
}

describe('vrais sujets du Bac 2026 (OCR)', () => {
  it('Maths M & TMGM (2 pages) : 5 exercices, 25/27 questions, 21/27 points', () => {
    const r = mesurer('m-maths');
    expect(r.d.exercices.map((e) => `${e.titre} (${e.points})`)).toEqual(['Exercice 1 (3)', 'Exercice 2 (4)', 'Exercice 3 (5)', 'Exercice 4 (4)', 'Exercice 5 (4)']);
    expect(r.trouvees).toBeGreaterThanOrEqual(25);
    expect(r.points).toBeGreaterThanOrEqual(21);
  });
  it('Maths SN (photo sur une table) : 9/10 questions, 6/10 points', () => {
    const r = mesurer('sn-maths-p1');
    expect(r.trouvees).toBeGreaterThanOrEqual(9);
    expect(r.points).toBeGreaterThanOrEqual(6);
  });
  it('Sciences naturelles SN : parties QCM / QROC / exercice, 12/12 questions et points', () => {
    const r = mesurer('sn-svt-p2');
    expect(r.trouvees).toBe(12);
    expect(r.points).toBe(12);
  });
  it('PDF avec texte intégré (Maths M & TMGM) : 27/27 questions et points, le corrigé est ignoré', () => {
    const d = decouperSujet(lire('pdf-texte-m-maths.txt'));
    const qs = d.exercices.flatMap((e) => e.questions);
    expect(qs).toHaveLength(27);
    expect(qs.every((q) => q.points !== null)).toBe(true);
    expect(qs.reduce((t, q) => t + q.points!, 0)).toBe(20);
    const v = verite['m-maths'];
    for (const e of d.exercices) for (const q of e.questions) expect(q.points).toBe(v[e.titre][q.id]);
  });
});
