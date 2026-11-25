// Packs réels du Bac mauritanien (étape 7) : validation, calculs, sensibilité des vérifications,
// feuille-réponse et correction d'une copie simulée.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validerPack, verifierPackMath, verifier, specFeuille, simulerFeuille, readSheet, copieDepuisLecture, noterCopie,
  type Pack, type Verification, type MarqueSimulee,
} from '../src/index.ts';

const dossier = resolve(import.meta.dirname, '../../../packs');
const fichiers = readdirSync(dossier).filter((f) => f.startsWith('bac-') && f.endsWith('.json'));
const lire = (f: string) => JSON.parse(readFileSync(resolve(dossier, f), 'utf8')) as Pack;
const maths = lire('bac-2026-normale-maths-M-TMGM.json');

describe('packs du Bac', () => {
  it('7 packs présents', () => expect(fichiers.length).toBe(7));
  for (const f of fichiers) {
    it(`${f} : valide, calculs vérifiés, imprimable`, () => {
      const p = lire(f);
      expect(validerPack(p).erreurs).toEqual([]);
      for (const r of verifierPackMath(p)) expect(r.ok, `${r.question} ${r.quoi} : ${r.detail}`).toBe(true);
      expect(() => specFeuille(p)).not.toThrow();
    });
  }

  it('Maths M & TMGM 2026 : complet (20 pts) et chaque exercice calculable est vérifié', () => {
    expect(maths.total).toBe(20);
    expect(maths.meta?.partiel).toBeUndefined();
    const sans = maths.questions.filter((q) => !q.verification).map((q) => q.id);
    // restent sans calcul : une représentation paramétrique, une équivalence logique, une figure
    expect(sans).toEqual(['Ex1-2a', 'Ex1-2b', 'Ex3-1']);
    expect(verifierPackMath(maths).length).toBeGreaterThanOrEqual(70);
  });

  it('les vérifications détectent une réponse fausse (sensibilité)', () => {
    const toutes = maths.questions.flatMap((q) => [q.verification ?? []].flat().map((v) => ({ q: q.id, v })));
    let testees = 0;
    for (const { q, v } of toutes) {
      let faux: Verification | null = null;
      const type = v.type ?? 'egal';
      if (type === 'egal' && v.egal_a && !/^\[/.test(v.egal_a)) faux = { ...v, egal_a: `(${v.egal_a}) + 1/7` };
      else if (type === 'egal' && v.egal_a) faux = { ...v, egal_a: `(${v.egal_a}) * 2` };
      else if (type === 'limite') faux = { ...v, egal_a: v.egal_a === '0' ? '5' : v.egal_a === '+inf' ? '-inf' : v.egal_a === '-inf' ? '+inf' : '0' };
      else if (type === 'vrai') faux = { ...v, expression: `not (${v.expression})` };
      else if (type === 'primitive') faux = { ...v, egal_a: `(${v.egal_a}) * 2` };
      if (!faux) continue;
      testees++;
      expect(verifier(faux).ok, `${q} — ${v.quoi} devrait échouer`).toBe(false);
    }
    expect(testees).toBe(toutes.length);
  });

  it('copie simulée du Bac Maths : les points notés sur la feuille donnent la note', () => {
    const items = specFeuille(maths);
    const marques: Record<string, MarqueSimulee> = {};
    let attendu = 0;
    items.forEach((it, i) => {
      // l'élève obtient la valeur médiane des cases de points de chaque question
      const k = Math.floor(it.labels.length / 2);
      marques[it.id] = { labels: [it.labels[k]], gris: i % 3 ? 40 : 150 };
      attendu += it.valeurs![k];
    });
    const o = { largeur: 900, hauteur: 1250, coins: [[150, 120], [780, 160], [80, 1160], [850, 1110]] as [[number, number], [number, number], [number, number], [number, number]] };
    const g = simulerFeuille(items, marques, o);
    const r = readSheet(g, 900, 1250, items);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const res = noterCopie(maths, copieDepuisLecture(items, r.lignes, 'Élève test'));
    expect(res.note).toBe(attendu);
    expect(res.sur20).toBe(Math.round(attendu * 100) / 100);
  });
});
