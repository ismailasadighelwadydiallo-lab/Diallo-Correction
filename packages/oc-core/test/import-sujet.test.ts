import { describe, expect, it } from 'vitest';
import { decouperSujet, sujetVersPack, validerPack, corrigeComplet, corrigerFormulesOcr, pointsDans } from '../src/index.ts';

const SUJET = `République Islamique de Mauritanie
Baccalauréat 2026 — Mathématiques — Série SN
Exercice 1 (4 points)
1) Résoudre dans R l'équation x^2 - 5x + 6 = 0. (1 pt)
2) Développer (x+1)^2 (1 pt)
3) Soit f(x) = x e^(2-x).
a) Dériver f(x) = x e^(2-x) (1 pt)
b) Calculer la limite de (x^2-1)/(x-1) quand x tend vers 1 (1 pt)
Exercice 2 (6 pts)
Une urne contient 3 boules rouges et 2 boules noires.
1. Calculer la probabilité de tirer une boule rouge.
2. On tire deux boules successivement
sans remise. Calculer la probabilité de tirer deux boules rouges.`;

describe('import du sujet : découpage', () => {
  const s = decouperSujet(SUJET);
  it('titre, exercices, questions, sous-questions', () => {
    expect(s.titre).toBe('Baccalauréat 2026 — Mathématiques — Série SN');
    expect(s.exercices.map((e) => [e.titre, e.points])).toEqual([['Exercice 1', 4], ['Exercice 2', 6]]);
    expect(s.exercices[0].questions.map((q) => q.id)).toEqual(['1', '2', '3.a', '3.b']);
    expect(s.exercices[0].questions[2].contexte).toBe('Soit f(x) = x e^(2-x).');
    expect(s.exercices[1].questions[1].enonce).toMatch(/successivement sans remise/); // ligne coupée recollée
  });
  it("points : lus dans le sujet, jamais inventés au découpage", () => {
    expect(s.exercices[0].questions.map((q) => q.points)).toEqual([1, 1, 1, 1]);
    expect(s.exercices[1].questions.map((q) => q.points)).toEqual([null, null]);
    expect(s.avertissements.join(' ')).toMatch(/2 question\(s\) sans points/);
  });
  it('pack valide ; points manquants proposés et signalés ; barème non officiel', () => {
    const p = sujetVersPack(s, { id: 'sujet-test', lecture: { source: 'photo', confiance: 88 } });
    expect(validerPack(p).ok).toBe(true);
    expect(p.total).toBe(10);
    expect(p.bareme_source).toBeUndefined();
    expect(p.meta?.points_proposes).toHaveLength(2);
    const c = corrigeComplet(p);
    const f = c.fiches.find((x) => x.id === 'Ex1-1')!;
    expect(f.resultat).toBe('S = { 2 ; 3 }');
    expect(f.confiance.lecture).toBe('moyenne'); // OCR 88/100 : jamais « élevée »
    expect(c.fiches.find((x) => x.id === 'Ex2-1')!.confiance.notation).toBe('faible');
    expect(c.fiches.find((x) => x.id === 'Ex2-1')!.statut).toBe('insuffisant'); // probabilités : pas de solveur
  });
  it('sujet en arabe : en-têtes, chiffres arabes-indiens, points « ن »', () => {
    const a = decouperSujet('التمرين الأول (٤ نقاط)\n١) عرف الصلاة. (٢ ن)\n٢) اذكر أركان الإسلام. (٢ ن)\nالتمرين الثاني (6 نقاط)\n1) اشرح الحديث.');
    expect(a.exercices.map((e) => e.points)).toEqual([4, 6]);
    expect(a.exercices[0].questions.map((q) => q.points)).toEqual([2, 2]);
  });
  it('texte sans structure : averti, pas de faux découpage', () => {
    expect(decouperSujet('bonjour\nceci est un texte').avertissements[0]).toMatch(/Aucun exercice/);
  });
  it('OCR : seul le « ^ » lu comme guillemet est corrigé', () => {
    expect(corrigerFormulesOcr('x "2 - 5x ; e“(2-x) ; x”2')).toBe('x^2 - 5x ; e^(2-x) ; x^2');
    expect(corrigerFormulesOcr("l'équation ; « Bonjour » 3")).toBe("l'équation ; « Bonjour » 3");
    expect(pointsDans('(1,5 pt)')).toBe(1.5);
    expect(pointsDans('page 2')).toBeNull();
  });
});
