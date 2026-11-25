import { describe, expect, it } from 'vitest';
import { validerPack, lirePack } from '../src/index.ts';
import { packTest } from './fixtures.ts';

describe('format des packs', () => {
  it("accepte le pack d'exemple", () => {
    const r = validerPack(packTest());
    expect(r.erreurs).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it("accepte l'exemple du cahier des charges (avec format ajouté)", () => {
    const p = {
      format: 'oc-pack/1', id: 'bac-2026-normale-maths-M-TMGM', titre: 'Bac 2026', serie: 'M & TMGM', duree: '4h', total: 0.75, langue: 'fr',
      questions: [{
        id: 'Ex2-Q2', enonce: "Déterminer f'(x)…", points: 0.75, type: 'calcul',
        attendu: "f'(x) = (1 - x) e^(2 - x)",
        verification: { moteur: 'math', expression: 'diff(x*exp(2-x), x)', egal_a: '(1-x)*exp(2-x)' },
        etapes: [{ critere: 'Dérivée juste', points: 0.5 }, { critere: 'Tableau de variation juste', points: 0.25 }],
      }],
    };
    expect(validerPack(p).erreurs).toEqual([]);
  });
  it('refuse des points plus fins que 0,25 (règle 2)', () => {
    const p = packTest();
    p.questions[0].points = 1.1;
    const r = validerPack(p);
    expect(r.ok).toBe(false);
    expect(r.erreurs.join()).toMatch(/multiple de 0,25/);
  });
  it('refuse une somme des étapes différente des points', () => {
    const p = packTest();
    const q = p.questions.find((x) => x.etapes)!;
    q.etapes![0].points += 0.25;
    expect(validerPack(p).erreurs.join()).toMatch(/somme des étapes/);
  });
  it('refuse un total incohérent, une bonne réponse hors des choix, un champ inconnu', () => {
    const p = packTest();
    p.total = 21;
    (p.questions[0] as { bonnes: string[] }).bonnes = ['Z'];
    const r = validerPack(p);
    expect(r.erreurs.join()).toMatch(/total/);
    expect(r.erreurs.join()).toMatch(/absente des choix/);
    expect(validerPack({ ...packTest(), inconnu: 1 }).ok).toBe(false);
  });
  it('lirePack donne un message lisible', () => {
    expect(() => lirePack('pas du json')).toThrow(/JSON valide/);
    expect(() => lirePack('{"format":"oc-pack/1"}')).toThrow(/Pack invalide/);
  });
});
