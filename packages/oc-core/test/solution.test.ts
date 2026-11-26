import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resoudre, verifierRaisonnement, corrigeComplet, ficheQuestion, lirePack, validerPack, detecterMatiere, construireCatalogue, moteurMatiere, type Pack } from '../src/index.ts';

const pack = (f: string) => lirePack(readFileSync(new URL(`../../../packs/${f}`, import.meta.url), 'utf8'));

describe('solveur local', () => {
  it('équation du second degré : discriminant, racines vérifiées', () => {
    const r = resoudre('Résous x^2 - 5x + 6 = 0');
    expect(r.tache).toBe('equation');
    expect(r.resultat).toBe('S = { 2 ; 3 }');
    expect(r.confiance.niveau).toBe('elevee');
    expect(r.controles.length).toBeGreaterThan(0);
    expect(r.controles.every((c) => c.ok)).toBe(true);
  });
  it('racines complexes', () => {
    expect(resoudre('Résous z^2 - 2z + 5 = 0').resultat).toMatch(/1 − 2i ; 1 \+ 2i/);
  });
  it('dérivée vérifiée numériquement', () => {
    const r = resoudre('Dérive f(x) = x e^(2-x)');
    expect(r.resultat).toBe("f'(x) = (1 − x)·e^(2 − x)");
    expect(r.confiance.niveau).toBe('elevee');
  });
  it('limite : estimation numérique, jamais « élevée »', () => {
    const r = resoudre('Limite de (x^2-1)/(x-1) quand x tend vers 1');
    expect(r.resultat).toBe('lim f = 2');
    expect(r.confiance.niveau).toBe('moyenne');
  });
  it('calcul, développer, factoriser', () => {
    expect(resoudre('2/3 + 1/6').resultat).toBe('5/6');
    expect(resoudre('Développer (x+1)^2').resultat).toBe('x² + 2x + 1');
    expect(resoudre('Factoriser x^2 - 5x + 6').resultat).toBe('(x − 2)(x − 3)');
  });
  it("n'invente pas : information insuffisante", () => {
    for (const q of ['Résous x + y = 2', 'Explique la photosynthèse', 'Primitive de 2x']) {
      const r = resoudre(q);
      expect(r.confiance.niveau).toBe('aucune');
      expect(r.resultat).toMatch(/Information insuffisante/);
    }
  });
});

describe('vérifier mon raisonnement', () => {
  it('démarche juste', () => {
    const r = verifierRaisonnement('x^2 - 5x + 6 = 0\n(x - 2)(x - 3) = 0\nx = 2 ou x = 3', { equation: 'x^2-5x+6=0', attendu: ['2', '3'] });
    expect(r.lignes.map((l) => l.statut)).toEqual(['juste', 'juste', 'juste']);
    expect(r.resultatJuste).toBe(true);
  });
  it("trouve l'étape fausse et l'erreur entraînée", () => {
    const r = verifierRaisonnement('x^2 - 5x + 6 = 0\n(x - 2)(x - 4) = 0\nx = 2 ou x = 4', { equation: 'x^2-5x+6=0', attendu: ['2', '3'] });
    expect(r.lignes.map((l) => l.statut)).toEqual(['juste', 'erreur', 'entrainee']);
    expect(r.resultatJuste).toBe(false);
    expect(r.conclusion).toMatch(/étape 2/);
  });
  it('dérivée : erreur de signe dès la première ligne', () => {
    const ok = verifierRaisonnement("f'(x) = exp(2-x) - x*exp(2-x)\nf'(x) = (1-x)*exp(2-x)", { fonction: 'x*exp(2-x)' });
    expect(ok.lignes.map((l) => l.statut)).toEqual(['juste', 'juste']);
    const ko = verifierRaisonnement("f'(x) = exp(2-x) + x*exp(2-x)\nf'(x) = (1+x)*exp(2-x)", { fonction: 'x*exp(2-x)' });
    expect(ko.lignes.map((l) => l.statut)).toEqual(['erreur', 'entrainee']);
  });
  it('une phrase n\'est pas notée comme juste', () => {
    const r = verifierRaisonnement('On factorise le trinôme', {});
    expect(r.lignes[0].statut).not.toBe('juste');
  });
});

describe('corrigé de référence', () => {
  it('Bac maths : bilan honnête, questions à vérifier visibles', () => {
    const c = corrigeComplet(pack('bac-2026-normale-maths-M-TMGM.json'));
    expect(c.bilan.questions).toBe(27);
    expect(c.bilan.resolues + c.bilan.aVerifier + c.bilan.insuffisantes).toBe(27);
    expect(c.bilan.aVerifier).toBeGreaterThan(0);
    expect(c.fiches).toHaveLength(27); // rien n'est caché
    expect(c.baremeSource).toBe('propose');
    expect(c.fiches.every((f) => f.confiance.notation !== 'elevee')).toBe(true); // barème non officiel
  });
  it('quatre confiances séparées, lecture « sans objet » pour un pack', () => {
    const p = pack('bac-2026-normale-maths-M-TMGM.json');
    const f = ficheQuestion(p, p.questions[0]);
    expect(Object.keys(f.confiance).sort()).toEqual(['comprehension', 'lecture', 'notation', 'resolution']);
    expect(f.confiance.lecture).toBe('sans_objet');
  });
  it('sans barème déclaré : origine inconnue, jamais « officiel »', () => {
    const c = corrigeComplet(pack('demo-devoir-qcm.json'));
    expect(c.baremeSource).toBe('inconnu');
    expect(c.bilan.insuffisantes).toBe(2);
  });
  it('une vérification fausse rend la question « à vérifier »', () => {
    const p = pack('bac-2026-normale-maths-M-TMGM.json');
    const q = p.questions.find((x) => x.verification)!;
    const v = Array.isArray(q.verification) ? q.verification[0] : q.verification!;
    const faux = { ...q, verification: { ...v, expression: '1', egal_a: '2', type: undefined } } as typeof q;
    const f = ficheQuestion(p, faux);
    expect(f.controles.some((c) => !c.ok)).toBe(true);
    expect(f.statut).toBe('a_verifier');
  });
  it('sans corrigé, le solveur tente la question et le dit', () => {
    const p: Pack = { ...pack('demo-devoir-qcm.json'), questions: [{ id: 'Q1', type: 'calcul', enonce: 'Résous x^2 - 5x + 6 = 0', points: 2 } as Pack['questions'][number]], total: 2 };
    const f = ficheQuestion(p, p.questions[0]);
    expect(f.origine).toBe('solveur');
    expect(f.resultat).toBe('S = { 2 ; 3 }');
  });
});

describe('catalogue et moteurs par matière', () => {
  it('matière déclarée ou devinée, jamais certaine sans indice', () => {
    expect(detecterMatiere({ matiere: 'physique-chimie', titre: '', id: '' }).confiance).toBe('elevee');
    expect(detecterMatiere({ titre: 'Bac Sciences physiques', id: 'x' }).valeur).toBe('physique-chimie');
    expect(detecterMatiere({ titre: 'Devoir', id: 'x' }).valeur).toBeNull();
    expect(moteurMatiere('inexistant').cle).toBe('autre');
  });
  it('arbre construit depuis les packs, sans liste figée', () => {
    const a = construireCatalogue([pack('bac-2026-normale-maths-M-TMGM.json'), pack('demo-devoir-qcm.json')]);
    expect(Object.keys(a)).toContain('Baccalauréat');
    expect(Object.keys(a)).toContain('non précisé');
  });
  it('le schéma accepte les nouveaux champs (solution, barème proposé, examen)', () => {
    const p = pack('demo-devoir-qcm.json');
    const r = validerPack({ ...p, examen: 'BEPC', matiere: 'mathematiques', annee: 2026, bareme_source: 'propose',
      questions: [{ ...p.questions[0], solution: { methode: 'm', etapes: [{ texte: 'a', calcul: '1+1=2' }], resultat: '2' }, methodes_alternatives: [{ nom: 'Autre' }] }, ...p.questions.slice(1)] });
    expect(r.erreurs ?? []).toEqual([]);
    expect(validerPack({ ...p, bareme_source: 'invente' }).ok).toBe(false);
  });
});
