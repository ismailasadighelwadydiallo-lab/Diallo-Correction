import { describe, expect, it } from 'vitest';
import { noterCopie, noterQuestion, modifierNote, statistiques, exporterCsv, normaliserTexte, type Copie, type Question } from '../src/index.ts';
import { packTest } from './fixtures.ts';

const pack = packTest();
const Q = (id: string) => pack.questions.find((q) => q.id === id)! as Question;

describe('QCM (règle 5)', () => {
  it('une bonne réponse', () => {
    expect(noterQuestion(Q('Ex1-Q1'), { choix: ['B'] }).points).toBe(1);
    const r = noterQuestion(Q('Ex1-Q1'), { choix: ['C'] });
    expect(r.points).toBe(0);
    expect(r.explications[0]).toMatch(/Réponse C, la bonne réponse est B/);
  });
  it('pas de points négatifs, sauf si le sujet le dit', () => {
    const q = { ...Q('Ex1-Q1'), penalite: 0.25 } as Question;
    expect(noterQuestion(q, { choix: ['A'] }, {}).points).toBe(0);
    expect(noterQuestion(q, { choix: ['A'] }, { qcm_negatif: true }).points).toBe(-0.25);
    // la note de la copie ne descend jamais sous 0
    const p = { ...pack, regles: { qcm_negatif: true }, questions: [q] };
    expect(noterCopie({ ...p, total: 1 }, { reponses: { 'Ex1-Q1': { choix: ['A'] } } }).note).toBe(0);
  });
  it('deux cases cochées sur un QCM à une réponse : 0 et explication', () => {
    const r = noterQuestion(Q('Ex1-Q1'), { choix: ['B', 'C'] });
    expect(r.points).toBe(0);
    expect(r.explications[0]).toMatch(/Plusieurs cases/);
  });
  it('plusieurs bonnes réponses — tout ou rien', () => {
    expect(noterQuestion(Q('Ex1-Q2'), { choix: ['A', 'C'] }).points).toBe(1);
    expect(noterQuestion(Q('Ex1-Q2'), { choix: ['C', 'A'] }).points).toBe(1);
    const r = noterQuestion(Q('Ex1-Q2'), { choix: ['A'] });
    expect(r.points).toBe(0);
    expect(r.explications[0]).toMatch(/manque C/);
  });
  it('plusieurs bonnes réponses — points partiels, arrondis au 0,25 inférieur', () => {
    // 2 bonnes sur 3 : 2/3 pt → 0,5
    expect(noterQuestion(Q('Ex1-Q3'), { choix: ['A', 'B'] }).points).toBe(0.5);
    // 2 bonnes et 1 fausse : (2-1)/3 → 0,25
    expect(noterQuestion(Q('Ex1-Q3'), { choix: ['A', 'B', 'D'] }).points).toBe(0.25);
    // toutes fausses : 0, jamais négatif
    expect(noterQuestion(Q('Ex1-Q3'), { choix: ['D'] }).points).toBe(0);
    expect(noterQuestion(Q('Ex1-Q3'), { choix: ['A', 'B', 'C'] }).points).toBe(1);
  });
  it('la règle multi peut être choisie par l\'enseignant au niveau du pack', () => {
    const q = { ...Q('Ex1-Q2') } as Question;
    delete (q as { regle_multi?: string }).regle_multi;
    expect(noterQuestion(q, { choix: ['A'] }, { qcm_multi: 'partiel' }).points).toBe(0.5);
    expect(noterQuestion(q, { choix: ['A'] }, { qcm_multi: 'tout_ou_rien' }).points).toBe(0);
  });
});

describe('numérique (tolérance, unités)', () => {
  const q = Q('Ex2-Q1');
  it('valeur exacte, virgule décimale, dans la tolérance', () => {
    expect(noterQuestion(q, { valeur: '12,5 m/s' }).points).toBe(1);
    expect(noterQuestion(q, { valeur: '12.6 m/s' }).points).toBe(1); // 0,8 % < 2 %
    expect(noterQuestion(q, { valeur: '13 m/s' }).points).toBe(0);
  });
  it('conversion d\'unité', () => {
    expect(noterQuestion(q, { valeur: '45 km/h' }).points).toBe(1);
    const r = noterQuestion(q, { valeur: '45 kg' });
    expect(r.points).toBe(0);
    expect(r.explications[0]).toMatch(/Unité « kg » incorrecte/);
  });
  it('unité manquante : −0,25', () => {
    const r = noterQuestion(q, { valeur: '12.5' });
    expect(r.points).toBe(0.75);
    expect(r.explications[0]).toMatch(/Unité manquante/);
  });
  it('fraction et valeur illisible', () => {
    expect(noterQuestion({ ...q, unite: undefined, valeur: 0.75 } as Question, { valeur: '3/4' }).points).toBe(1);
    expect(noterQuestion(q, { valeur: 'je sais pas' }).points).toBe(0);
  });
});

describe('texte court', () => {
  const q = Q('Ex2-Q2');
  it('ignore majuscules, accents, espaces ; accepte les synonymes', () => {
    expect(noterQuestion(q, { texte: 'MITOCHONDRIE' }).points).toBe(1);
    expect(noterQuestion(q, { texte: '  La  Mitochondrie. ' }).points).toBe(1);
    expect(noterQuestion(q, { texte: 'mitochondríe' }).points).toBe(1);
    expect(noterQuestion(q, { texte: 'noyau' }).points).toBe(0);
  });
  it('arabe : voyelles brèves et formes de alif ignorées', () => {
    expect(normaliserTexte('المُتَقَدِّرَة')).toBe(normaliserTexte('المتقدره'));
    expect(normaliserTexte('أحمد')).toBe(normaliserTexte('احمد'));
  });
});

describe('barème par étapes (règle 1) et erreur entraînée (règle 4)', () => {
  const q = Q('Ex3-Q1');
  it('tout juste', () => {
    const r = noterQuestion(q, { etapes: { a: { valeur: '12' }, b: { valeur: '25' }, c: { valeur: '625' } } });
    expect(r.points).toBe(3);
    expect(r.etapes.map((e) => e.points)).toEqual([1, 1, 1]);
  });
  it('une erreur de calcul n\'est pénalisée qu\'une fois', () => {
    // a faux (13), b = 2×13+1 = 27 cohérent, c = 27² = 729 cohérent
    const r = noterQuestion(q, { etapes: { a: { valeur: '13' }, b: { valeur: '27' }, c: { valeur: '729' } } });
    expect(r.etapes.map((e) => e.points)).toEqual([0, 1, 1]);
    expect(r.points).toBe(2);
    expect(r.etapes[1].entrainee).toBe(true);
    expect(r.explications.join(' ')).toMatch(/Erreur entraînée/);
  });
  it('une suite incohérente perd ses points', () => {
    const r = noterQuestion(q, { etapes: { a: { valeur: '13' }, b: { valeur: '30' }, c: { valeur: '900' } } });
    // b incohérent (0) ; c cohérent avec le b de l'élève (30² = 900) : garde ses points
    expect(r.etapes.map((e) => e.points)).toEqual([0, 0, 1]);
  });
  it('étape absente = 0 avec explication', () => {
    const r = noterQuestion(q, { etapes: { a: { valeur: '12' } } });
    expect(r.points).toBe(1);
    expect(r.explications.join(' ')).toMatch(/Calcul de b : absent/);
  });
  it('copie vide : 0, « Pas de réponse »', () => {
    const r = noterQuestion(q, undefined);
    expect(r.points).toBe(0);
    expect(r.explications).toEqual(['Pas de réponse.']);
  });
});

describe('« Montrer que » (règle 3)', () => {
  const q = Q('Ex3-Q2');
  it('résultat recopié sans démonstration = 0', () => {
    const r = noterQuestion(q, { etapes: { resultat: { valeur: '(1-x)e^(2-x)' } } });
    expect(r.points).toBe(0);
    expect(r.explications.join()).toMatch(/sans démonstration/);
  });
  it('démonstration présente : points', () => {
    const r = noterQuestion(q, { etapes: { methode: { statut: 'juste', source: 'enseignant' }, resultat: { valeur: 'exp(2-x) - x exp(2-x)' } } });
    expect(r.points).toBe(1);
  });
});

describe('méthode différente (règle 7)', () => {
  it('acceptée si le résultat est vérifié par le moteur de calcul', () => {
    const r = noterQuestion(Q('Ex3-Q1'), { etapes: {}, methode_alternative: { valeur: '25^2', justifiee: true } });
    expect(r.points).toBe(3);
    expect(r.explications[0]).toMatch(/Méthode différente/);
    expect(r.confiance.notation).toBeLessThan(1);
  });
  it('refusée si le résultat est faux', () => {
    expect(noterQuestion(Q('Ex3-Q1'), { etapes: {}, methode_alternative: { valeur: '600', justifiee: true } }).points).toBe(0);
  });
  it('« montrer que » : un résultat juste mais non justifié vaut 0', () => {
    expect(noterQuestion(Q('Ex3-Q2'), { etapes: {}, methode_alternative: { valeur: '(1-x)exp(2-x)', justifiee: false } }).points).toBe(0);
  });
});

describe('figures : grille de critères (règle 6)', () => {
  it('points par critère, explication des critères manquants', () => {
    const r = noterQuestion(Q('Ex4-Q1'), { etapes: { repere: { statut: 'juste', source: 'enseignant' }, points: { statut: 'juste', source: 'enseignant' }, allure: { statut: 'faux', source: 'enseignant' }, legende: { statut: 'absent', source: 'enseignant' } } });
    expect(r.points).toBe(1);
    expect(r.explications).toEqual(['Allure de la courbe : non satisfait.', 'Légende : absent.']);
  });
  it('jugement venant d\'une IA : confiance plus basse, copie signalée', () => {
    const r = noterQuestion(Q('Ex4-Q1'), { etapes: { repere: { statut: 'juste', source: 'ia' } } });
    expect(r.confiance.notation).toBe(0.6);
  });
});

describe('copie complète, confiance, modification par l\'enseignant', () => {
  const copie: Copie = {
    eleve: 'Aminata',
    reponses: {
      'Ex1-Q1': { choix: ['B'], lecture: { confiance: 1, statut: 'ok' } },
      'Ex1-Q2': { choix: ['A', 'C'], lecture: { confiance: 0.4, statut: 'incertain' } },
      'Ex2-Q2': { texte: 'mitochondrie' },
      'Ex5-Q1': { points: 7.5 },
    },
  };
  it('note sur 20, total, signalement sans blocage', () => {
    const r = noterCopie(pack, copie);
    expect(r.note).toBe(10.5);
    expect(r.sur20).toBe(10.5);
    expect(r.douteuse).toBe(true);
    expect(r.raisons_doute.join()).toMatch(/Ex1-Q2/);
    expect(r.confiance.lecture).toBe(0.4);
    // chaque question a des points par étape
    for (const q of r.questions) expect(q.etapes.length).toBeGreaterThan(0);
  });
  it('l\'enseignant modifie une note : la modification est enregistrée', () => {
    const r0 = noterCopie(pack, copie);
    const r1 = modifierNote(pack, copie, r0, 'Ex4-Q1', 1.5, 'figure correcte', '2026-11-25T10:00:00Z');
    expect(r1.note).toBe(12);
    expect(r1.modifications).toEqual([{ question: 'Ex4-Q1', ancien: 0, nouveau: 1.5, motif: 'figure correcte', date: '2026-11-25T10:00:00Z' }]);
    const q = r1.questions.find((x) => x.id === 'Ex4-Q1')!;
    expect(q.modifiee).toBe(true);
    expect(q.points_auto).toBe(0);
    expect(() => modifierNote(pack, copie, r0, 'Ex4-Q1', 1.1)).toThrow(/0,25/);
    expect(() => modifierNote(pack, copie, r0, 'Ex4-Q1', 3)).toThrow(/entre/);
  });
  it('statistiques de classe et CSV', () => {
    const a = noterCopie(pack, copie);
    const b = noterCopie(pack, { reponses: { 'Ex5-Q1': { points: 9 }, 'Ex1-Q1': { choix: ['B'] } } });
    const c = noterCopie(pack, { reponses: {} });
    const s = statistiques(pack, [a, b, c]);
    expect(s.n).toBe(3);
    expect(s.mediane).toBe(10);
    expect(s.moyenne).toBe(Math.round(((10.5 + 10 + 0) / 3) * 100) / 100);
    expect(s.parExercice.find((e) => e.exercice === 'Ex5')!.reussite).toBe(Math.round((16.5 / 27) * 100) / 100);
    const csv = exporterCsv(pack, [{ eleve: 'Aminata', resultat: a }]);
    expect(csv.startsWith('﻿"Élève"')).toBe(true);
    expect(csv).toContain('"10,5"');
  });
});
