import { describe, expect, it } from 'vitest';
import { equivalentes, verifier, normaliser, evaluerNombre } from '../src/index.ts';

describe('moteur mathématique (math.js)', () => {
  it('normalise les écritures françaises', () => {
    expect(normaliser('2,5 × x²')).toBe('2.5 * x^2');
    expect(evaluerNombre('√(16) + 1,5')).toBe(5.5);
    expect(evaluerNombre('ln(e)')).toBeCloseTo(1);
  });
  it('compare des expressions écrites différemment', () => {
    expect(equivalentes('(1-x)*exp(2-x)', 'exp(2-x) - x*exp(2-x)')).toBe(true);
    expect(equivalentes('(x+1)^2', 'x^2+2x+1')).toBe(true);
    expect(equivalentes('(x+1)^2', 'x^2+1')).toBe(false);
    expect(equivalentes('ln(x^2)', '2 ln(x)')).toBe(true); // comparé là où les deux existent (x > 0)
    expect(equivalentes('1/4', '0.25')).toBe(true);
  });
  it("vérifie l'exemple du cahier des charges : diff(x e^(2-x)) = (1-x) e^(2-x)", () => {
    const r = verifier({ moteur: 'math', expression: 'diff(x*exp(2-x), x)', egal_a: '(1-x)*exp(2-x)' });
    expect(r.ok).toBe(true);
    expect(verifier({ moteur: 'math', expression: 'diff(x*exp(2-x), x)', egal_a: '(1+x)*exp(2-x)' }).ok).toBe(false);
  });
  it('vérifie les racines : x² − 5x + 6 = 0 a pour solutions 2 et 3', () => {
    expect(verifier({ moteur: 'math', type: 'racines', expression: 'x^2-5x+6', valeurs: [2, 3] }).ok).toBe(true);
    expect(verifier({ moteur: 'math', type: 'racines', expression: 'x^2-5x+6', valeurs: [2, 4] }).ok).toBe(false);
  });
  it('vérifie une primitive', () => {
    expect(verifier({ moteur: 'math', type: 'primitive', expression: '2x*exp(x^2)', egal_a: 'exp(x^2)+3' }).ok).toBe(true);
  });

  it('nombres complexes, matrices, dérivée seconde', () => {
    expect(equivalentes('i*conj(i*conj(z) - 1 - i) - 1 - i', 'z - 2 - 2*i')).toBe(true);
    expect(equivalentes('[[1,2],[0,3]]^2', '[[1,8],[0,9]]')).toBe(true);
    expect(equivalentes('[[1,2],[0,3]]^2', '[[1,8],[0,8]]')).toBe(false);
    expect(verifier({ moteur: 'math', expression: 'diff(x*exp(2-x), x, 2)', egal_a: '(x-2)*exp(2-x)' }).ok).toBe(true);
    expect(evaluerNombre('2,5 + 1')).toBe(3.5);
  });
  it('limites (contrôle numérique)', () => {
    expect(verifier({ moteur: 'math', type: 'limite', expression: 'log(1+x)/x', variable: 'x', vers: '0+', egal_a: '1' }).ok).toBe(true);
    expect(verifier({ moteur: 'math', type: 'limite', expression: 'x*exp(2-x)', variable: 'x', vers: '-inf', egal_a: '-inf' }).ok).toBe(true);
    expect(verifier({ moteur: 'math', type: 'limite', expression: 'x*exp(2-x)', variable: 'x', vers: '+inf', egal_a: '1' }).ok).toBe(false);
  });
  it('inégalités sur un domaine', () => {
    expect(verifier({ moteur: 'math', type: 'vrai', expression: 'log(1+x) <= x', domaine: 'x > 0' }).ok).toBe(true);
    expect(verifier({ moteur: 'math', type: 'vrai', expression: '1/k^2 <= 1/(k-1) - 1/k', domaine: 'k > 1' }).ok).toBe(true);
    expect(verifier({ moteur: 'math', type: 'vrai', expression: 'x^2 < x', domaine: 'x > 0' }).ok).toBe(false);
  });
});
