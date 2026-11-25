// Vérifications par le moteur de calcul ajoutées aux packs du Bac (étape 7).
// Chaque entrée refait, avec math.js, un calcul du corrigé proposé.
// Les limites sont contrôlées NUMÉRIQUEMENT (suite de valeurs) : c'est un indice fort, pas une preuve.
import type { Verification } from '../packages/oc-core/src/index.ts';

const v = (quoi: string, expression: string, egal_a?: string, extra: Partial<Verification> = {}): Verification => ({ moteur: 'math', quoi, expression, ...(egal_a !== undefined ? { egal_a } : {}), ...extra });
const A = '[[1,2,0],[0,3,0],[0,0,5]]';

export const VERIFICATIONS: Record<string, Record<string, Verification[]>> = {
  'bac-2026-normale-maths-M-TMGM': {
    'Ex1-1a': [
      v('A² = [[1,8,0],[0,9,0],[0,0,25]]', `${A}^2`, '[[1,8,0],[0,9,0],[0,0,25]]'),
      ...[3, 4, 6].map((n) => v(`formule de Aⁿ pour n = ${n}`, `${A}^${n}`, `[[1,3^${n}-1,0],[0,3^${n},0],[0,0,5^${n}]]`)),
      v('hérédité : ligne 1 de Aⁿ·A = 3ⁿ⁺¹ − 1', '2 + 3*(3^n - 1)', '3^(n+1) - 1'),
    ],
    'Ex1-1b': [3, 5].map((n) => v(`Xₙ = Aⁿ·X₀ pour n = ${n}`, `${A}^${n} * [1,1,3]`, `[3^${n}, 3^${n}, 3*5^${n}]`)),
    'Ex1-3': [
      v('(−2 ; −8) est solution', '15*(-2) - 4*(-8)', '2'),
      v('solution générale : 15x − 4y = 2 pour tout m', '15*(-2+4*m) - 4*(-8+15*m)', '2'),
      v('z = 2 + 4t avec t = −8 + 15m', '2 + 4*(-8+15*m)', '60*m - 30'),
      v('x = 3t', '3*(-8+15*m)', '45*m - 24'),
      v('y = 1 + 5t', '1 + 5*(-8+15*m)', '75*m - 39'),
    ],
    'Ex2-1': [
      v('lim f en +∞ = 0', 'x*exp(2-x)', '0', { type: 'limite', variable: 'x', vers: '+inf' }),
      v('lim f en −∞ = −∞', 'x*exp(2-x)', '-inf', { type: 'limite', variable: 'x', vers: '-inf' }),
      v('lim f(x)/x en −∞ = +∞', 'exp(2-x)', '+inf', { type: 'limite', variable: 'x', vers: '-inf' }),
      v('f(x)/x = e^(2−x)', 'x*exp(2-x)/x', 'exp(2-x)'),
    ],
    'Ex2-2': [
      v("f'(x) = (1 − x)e^(2−x)", 'diff(x*exp(2-x), x)', '(1-x)*exp(2-x)'),
      v('maximum f(1) = e', '1*exp(2-1)', 'e'),
      v("f' ≥ 0 sur ]−∞ ; 1]", '(1-x)*exp(2-x) >= 0', undefined, { type: 'vrai', domaine: 'x <= 1' }),
      v("f' ≤ 0 sur [1 ; +∞[", '(1-x)*exp(2-x) <= 0', undefined, { type: 'vrai', domaine: 'x >= 1' }),
    ],
    'Ex2-3': [
      v("f''(x) = (x − 2)e^(2−x)", 'diff(x*exp(2-x), x, 2)', '(x-2)*exp(2-x)'),
      v("f''(2) = 0", '(2-2)*exp(2-2)', '0'),
      v('A(2 ; 2) : f(2) = 2', '2*exp(2-2)', '2'),
    ],
    'Ex2-4a': [
      v('uₙ₊₁ − uₙ : intégrande xⁿ(x − 1)e^(2−x) ≤ 0 sur [0 ; 1]', 'x^n*(x-1)*exp(2-x) <= 0', undefined, { type: 'vrai', domaine: 'x >= 0 and x <= 1 and n >= 1' }),
      v('xⁿ⁺¹e^(2−x) − xⁿe^(2−x) = xⁿ(x − 1)e^(2−x)', 'x^(n+1)*exp(2-x) - x^n*exp(2-x)', 'x^n*(x-1)*exp(2-x)'),
    ],
    'Ex2-4b': [
      v('e ≤ e^(2−x) ≤ e² sur [0 ; 1]', 'e <= exp(2-x) and exp(2-x) <= e^2', undefined, { type: 'vrai', domaine: 'x >= 0 and x <= 1' }),
      v('lim e²/(n+1) = 0', 'e^2/(n+1)', '0', { type: 'limite', variable: 'n', vers: '+inf' }),
    ],
    'Ex3-2': [
      v('f(B) = D', 'i*conj(i) - 1 - i', '-i'),
      v('f(E) = O', 'i*conj(1+i) - 1 - i', '0'),
      v('f∘f = translation de vecteur −2 − 2i', 'i*conj(i*conj(z) - 1 - i) - 1 - i', 'z - 2 - 2*i'),
      v('BE = DO', 'abs((1+i) - i)', 'abs(0 - (-i))'),
    ],
    'Ex3-3': [
      v('R(B) = C', '-i*i - 2', '-1'),
      v('R(E) = G', '-i*(1+i) - 2', '-1-i'),
      v('centre F(−1 + i) fixe', '-i*(-1+i) - 2', '-1+i'),
      v('angle −π/2 : −i = e^(−iπ/2)', 'exp(-i*pi/2)', '-i'),
    ],
    'Ex3-4': [
      v('h(C) = B', '2*(-1) + 2 + i', 'i'),
      v('h(G) = D', '2*(-1-i) + 2 + i', '-i'),
      v('centre I(−2 − i) fixe', '2*(-2-i) + 2 + i', '-2-i'),
      v('C milieu de [IB]', '((-2-i) + i)/2', '-1'),
      v('G milieu de [ID]', '((-2-i) + (-i))/2', '-1-i'),
    ],
    'Ex3-5': [
      v('S = h∘R : S(z) = −2iz − 2 + i', '2*(-i*z - 2) + 2 + i', '-2*i*z - 2 + i'),
      v('S(B) = B', '-2*i*i - 2 + i', 'i'),
      v('S(A) = I', '-2*i*1 - 2 + i', '-2-i'),
      v('rapport 2 et angle −π/2', '-2*i', '2*exp(-i*pi/2)'),
    ],
    'Ex3-6': [
      v('g = R∘S : g(z) = −2z − 1 + 2i', '-i*(-2*i*z - 2 + i) - 2', '-2*z - 1 + 2*i'),
      v('centre J = (−1 + 2i)/3 fixe', '-2*((-1+2*i)/3) - 1 + 2*i', '(-1+2*i)/3'),
      v('J = barycentre de (B, 2) et (C, 1)', '(2*i + 1*(-1))/3', '(-1+2*i)/3'),
    ],
    'Ex4-1a': [
      v('Δ = (4ie^(iθ))²', '4*(m+i)^2 - 4*((m+i)^2 + 4*exp(2*i*t))', '(4*i*exp(i*t))^2'),
      v('z₁ = m + i + 2ie^(iθ) est solution', '(m+i+2*i*exp(i*t))^2 - 2*(m+i)*(m+i+2*i*exp(i*t)) + (m+i)^2 + 4*exp(2*i*t)', '0'),
      v('z₂ = m + i − 2ie^(iθ) est solution', '(m+i-2*i*exp(i*t))^2 - 2*(m+i)*(m+i-2*i*exp(i*t)) + (m+i)^2 + 4*exp(2*i*t)', '0'),
    ],
    'Ex4-1b': [
      v('PQ = |z₁ − z₂| = 4', 'abs(4*i*exp(i*t))', '4'),
      v('milieu I : (z₁ + z₂)/2 = m + i', '((m+i+2*i*exp(i*t)) + (m+i-2*i*exp(i*t)))/2', 'm + i'),
    ],
    'Ex4-2a': [
      v('centre Ω = milieu de [AB] = 1 + i', '((3+i) + (-1+i))/2', '1+i'),
      v('D et C sur la droite x = 1', 're(1 - 1.5*i) - re(1 + 2.5*i)', '0'),
    ],
    'Ex4-2b': [
      v('centre Ω', '((3+i) + (-1+i))/2', '1+i'),
      v('second foyer = symétrique de D par Ω', '2*(1+i) - (1+2.5*i)', '1 - 0.5*i'),
      v('quatrième sommet = symétrique de C par Ω', '2*(1+i) - (1-1.5*i)', '1 + 3.5*i'),
    ],
    'Ex4-2c': [
      v('a² = b² + c²', '(5/2)^2', '2^2 + (3/2)^2'),
      v('A(3 ; 1) sur E', '(3-1)^2/4 + (1-1)^2/(25/4)', '1'),
      v('B(−1 ; 1) sur E', '(-1-1)^2/4 + (1-1)^2/(25/4)', '1'),
      v('C(1 ; −3/2) sur E', '(1-1)^2/4 + (-3/2-1)^2/(25/4)', '1'),
      v('4ᵉ sommet (1 ; 7/2) sur E', '(1-1)^2/4 + (7/2-1)^2/(25/4)', '1'),
    ],
    'Ex5-1': [
      v('lim g en 0⁺ = 1', 'log(1+x)/x', '1', { type: 'limite', variable: 'x', vers: '0+' }),
      v('lim g en +∞ = 0', 'log(1+x)/x', '0', { type: 'limite', variable: 'x', vers: '+inf' }),
    ],
    'Ex5-2a': [
      v('x/(1 + x) ≤ ln(1 + x) pour x > 0', 'x/(1+x) <= log(1+x)', undefined, { type: 'vrai', domaine: 'x > 0' }),
      v('ln(1 + x) ≤ x pour x > 0', 'log(1+x) <= x', undefined, { type: 'vrai', domaine: 'x > 0' }),
      v('primitive : (ln(1 + t))′ = 1/(1 + t)', '1/(1+t)', 'log(1+t)', { type: 'primitive', variable: 't' }),
    ],
    'Ex5-2b': [
      v("g'(x) = [x/(1 + x) − ln(1 + x)]/x²", 'diff(log(1+x)/x, x)', '(x/(1+x) - log(1+x))/x^2'),
      v("g'(x) ≤ 0 pour x > 0", '(x/(1+x) - log(1+x))/x^2 <= 0', undefined, { type: 'vrai', domaine: 'x > 0' }),
    ],
    'Ex5-3a': [
      v('(1/k²)·g(1/k) = (1/k)·ln(1 + 1/k)', '(1/k^2)*(log(1+1/k)/(1/k))', '(1/k)*log(1+1/k)'),
      v('uₙ₊₁ − uₙ > 0', '(1/(n+1))*log(1+1/(n+1)) > 0', undefined, { type: 'vrai', domaine: 'n >= 1' }),
    ],
    'Ex5-3b': [
      v('1/(k(k + 1)) ≤ (1/k)ln(1 + 1/k) ≤ 1/k²', '1/(k*(k+1)) <= (1/k)*log(1+1/k) and (1/k)*log(1+1/k) <= 1/k^2', undefined, { type: 'vrai', domaine: 'k >= 1' }),
    ],
    'Ex5-3c': [
      v('1/k² ≤ 1/(k − 1) − 1/k pour k > 1', '1/k^2 <= 1/(k-1) - 1/k', undefined, { type: 'vrai', domaine: 'k > 1' }),
      v('1/(k − 1) − 1/k = 1/(k(k − 1))', '1/(k-1) - 1/k', '1/(k*(k-1))'),
      v('somme télescopique : Σ₂ⁿ (1/(k−1) − 1/k) = 1 − 1/n (n = 7)', 'sum(map(2:7, f(k) = 1/(k-1) - 1/k))', '1 - 1/7'),
      v('Σ₁ⁿ 1/(k(k+1)) = 1 − 1/(n+1) (n = 9)', 'sum(map(1:9, f(k) = 1/(k*(k+1))))', '1 - 1/10'),
    ],
  },

  // Pack partiel (page 1/2) : toutes les réponses mathématiques présentes sont vérifiées.
  'bac-2026-complementaire-maths-SN-TSGE': {
    'Ex1-Q1': [v('u₁ = 7, u₂ = 25, v₁ = 4u₁ − u₂ = 3 (réponse A)', '4*(3*2+4^0) - (3*(3*2+4^0)+4^1)', '3')],
    'Ex1-Q2': [v('vₙ = 4uₙ − (3uₙ + 4ⁿ) = uₙ − 4ⁿ (réponse C)', '4*u - (3*u + 4^n)', 'u - 4^n')],
    'Ex1-Q3': [
      v('vₙ₊₁ = 3vₙ avec uₙ = 3ⁿ + 4ⁿ', '(3*(3^n+4^n)+4^n) - 4^(n+1)', '3*3^n'),
      v('v₀ = 1', '2 - 4^0', '1'),
    ],
    'Ex1-Q4': [
      v('uₙ = 3ⁿ + 4ⁿ vérifie la récurrence (réponse B)', '3^(n+1)+4^(n+1)', '3*(3^n+4^n)+4^n'),
      v('u₀ = 2', '3^0+4^0', '2'),
    ],
    'Ex1-Q5': [v('uₙ₊₁ − uₙ > 0 (croissante, réponse A)', '(3^(n+1)+4^(n+1)) - (3^n+4^n) > 0', undefined, { type: 'vrai', domaine: 'n >= 0' })],
    'Ex1-Q6': [
      v('Sₙ = (3ⁿ⁺¹ − 1)/2 + (4ⁿ⁺¹ − 1)/3 = (2×4ⁿ⁺¹ + 3ⁿ⁺² − 5)/6 (réponse C)', '(3^(n+1)-1)/2 + (4^(n+1)-1)/3', '(2*4^(n+1)+3^(n+2)-5)/6'),
      v('S₅ calculée terme à terme', 'sum(map(0:5, f(k) = 3^k+4^k))', '(2*4^6 + 3^7 - 5)/6'),
    ],
    'Ex2-1a': [v('lim f en 0⁺ = +∞', '(2*x^2-1-2*log(x))/x^2', '+inf', { type: 'limite', variable: 'x', vers: '0+' })],
    'Ex2-1b': [
      v('lim f en +∞ = 2', '(2*x^2-1-2*log(x))/x^2', '2', { type: 'limite', variable: 'x', vers: '+inf' }),
      v('f(x) = 2 − 1/x² − 2ln(x)/x²', '(2*x^2-1-2*log(x))/x^2', '2 - 1/x^2 - 2*log(x)/x^2'),
    ],
    'Ex2-1c': [
      v('f(x) − 2 = (−1 − 2ln x)/x²', '(2*x^2-1-2*log(x))/x^2 - 2', '(-1-2*log(x))/x^2'),
      v('intersection en x = e^(−1/2)', '-1-2*log(exp(-1/2))', '0'),
      v('(C) au-dessus de (D) avant e^(−1/2)', '(-1-2*log(x))/x^2 > 0', undefined, { type: 'vrai', domaine: 'x > 0 and x < exp(-1/2)' }),
      v('(C) en dessous de (D) après e^(−1/2)', '(-1-2*log(x))/x^2 < 0', undefined, { type: 'vrai', domaine: 'x > exp(-1/2)' }),
    ],
    'Ex2-2b': [
      v('minimum f(1) = 1', '(2*1^2-1-2*log(1))/1^2', '1'),
      v("f' ≤ 0 sur ]0 ; 1]", '4*log(x)/x^3 <= 0', undefined, { type: 'vrai', domaine: 'x > 0 and x <= 1' }),
      v("f' ≥ 0 sur [1 ; +∞[", '4*log(x)/x^3 >= 0', undefined, { type: 'vrai', domaine: 'x >= 1' }),
    ],
    'Ex2-3a': [
      v('g(1) = 1', '(2*1^2-1-2*log(1))/1^2', '1'),
      v('g tend vers 2 en +∞ : J = [1 ; 2[', '(2*x^2-1-2*log(x))/x^2', '2', { type: 'limite', variable: 'x', vers: '+inf' }),
      v('g < 2 sur [1 ; +∞[', '(2*x^2-1-2*log(x))/x^2 < 2', undefined, { type: 'vrai', domaine: 'x >= 1' }),
    ],
  },

  // Pack partiel (page 1/2) : toutes les réponses mathématiques présentes sont vérifiées.
  'bac-2025-normale-maths-M-TMGM': {
    'Ex1-1a': [
      v('(35 ; 29) est solution', '62*35 - 5*29', '2025'),
      v('x = 35 + 5k, y = 29 + 62k sont solutions pour tout k', '62*(35+5*k) - 5*(29+62*k)', '2025'),
    ],
    'Ex1-1b': [v('x = 35 + 5k est multiple de 5 (k = −3..3)', 'sum(map(-3:3, f(k) = mod(35+5*k, 5)))', '0')],
    'Ex1-2a': [
      v('a¹⁰ ≡ 1 [11] pour a = 1..10 (Fermat)', 'sum(map(1:10, f(a) = mod(a^10, 11)))', '10'),
      v('a¹⁰ ≡ 0 [11] pour a = 11', 'mod(11^10, 11)', '0'),
    ],
    'Ex1-2b': [v('2025 = 3⁴ × 5² n\'est pas divisible par 11', 'mod(2025, 11) != 0 and 3^4*5^2 == 2025', 'true')],
    'Ex1-2c': [
      v('62 ≡ 7 [11]', 'mod(62, 11)', '7'),
      v('cas (1,1) : 62 − 5 ≡ 2 [11]', 'mod(62 - 5, 11)', '2'),
      v('cas (1,0) : 62 ≡ 7 [11]', 'mod(62, 11)', '7'),
      v('cas (0,1) : −5 ≡ 6 [11]', 'mod(-5, 11)', '6'),
      v('2025 ≡ 1 [11]', 'mod(2025, 11)', '1'),
    ],
    'Ex2-1': [
      v('P(2) = 0', '2^3 - (6+4*i*sin(a))*2^2 + (8+16*i*sin(a))*2 - 16*i*sin(a)', '0'),
      v('P(z₁) = 0, z₁ = 2 + 2e^(iα)', '(2+2*exp(i*a))^3 - (6+4*i*sin(a))*(2+2*exp(i*a))^2 + (8+16*i*sin(a))*(2+2*exp(i*a)) - 16*i*sin(a)', '0'),
      v('P(z₂) = 0, z₂ = 2 − 2e^(−iα)', '(2-2*exp(-i*a))^3 - (6+4*i*sin(a))*(2-2*exp(-i*a))^2 + (8+16*i*sin(a))*(2-2*exp(-i*a)) - 16*i*sin(a)', '0'),
      v('factorisation P(z) = (z − 2)(z² − (4 + 4i sinα)z + 8i sinα)', '(z-2)*(z^2 - (4+4*i*sin(a))*z + 8*i*sin(a))', 'z^3 - (6+4*i*sin(a))*z^2 + (8+16*i*sin(a))*z - 16*i*sin(a)'),
      v('Δ = (4cosα)²', '(4+4*i*sin(a))^2 - 4*8*i*sin(a)', '(4*cos(a))^2'),
    ],
    'Ex2-2a': [
      v('z₂ − 2 = −e^(−2iα)(z₁ − 2)', '-exp(-2*i*a)*(2*exp(i*a))', '-2*exp(-i*a)'),
      v('angle π − 2α : −e^(−2iα) = e^(i(π − 2α))', '-exp(-2*i*a)', 'exp(i*(pi-2*a))'),
    ],
    'Ex2-2b': [
      v('α = π/3 : angle π − 2α = π/3', 'exp(i*(pi-2*pi/3))', 'exp(i*pi/3)'),
      v('α = −π/3 : angle ≡ −π/3', 'exp(i*(pi+2*pi/3))', 'exp(-i*pi/3)'),
    ],
    'Ex2-2c': [
      v('AM₁ = 2', 'abs(2*exp(i*a))', '2'),
      v('AM₂ = 2', 'abs(-2*exp(-i*a))', '2'),
    ],
    'Ex2-2d': [v('z₁ − z₂ = 4cosα (réel)', '(2+2*exp(i*a)) - (2-2*exp(-i*a))', '4*cos(a)')],
    'Ex2-2e': [
      v('z_G = 2 + 3cosα + 4i sinα', '(-12*2 + 21*(2+2*exp(i*a)) + 3*(2-2*exp(-i*a)))/12', '2 + 3*cos(a) + 4*i*sin(a)'),
      v('(x − 2)²/9 + y²/16 = 1', '(3*cos(a))^2/9 + (4*sin(a))^2/16', '1'),
      v('excentricité e = √7/4', 'sqrt(16-9)/4', 'sqrt(7)/4'),
    ],
    'Ex3-2': [
      v('R(A) = I', '-i*0 + (1+i)/2', '(1+i)/2'),
      v('R(I) = B', '-i*(1+i)/2 + (1+i)/2', '1'),
      v('centre K(1/2) fixe', '-i*(1/2) + (1+i)/2', '1/2'),
    ],
    'Ex3-3a': [
      v('g(A) = I', 'conj(0) + (1+i)/2', '(1+i)/2'),
      v('g(I) = B', 'conj((1+i)/2) + (1+i)/2', '1'),
      v('g∘g(z) = z + 1', 'conj(conj(z) + (1+i)/2) + (1+i)/2', 'z + 1'),
      v('axe y = 1/4 conservé, glissement de 1/2', 'conj(x + i/4) + (1+i)/2', 'x + 1/2 + i/4'),
    ],
    'Ex3-3b': [
      v('S_Δ∘R = g avec S_Δ(z) = −i z̄ + 1 + i', '-i*conj(-i*z + (1+i)/2) + 1 + i', 'conj(z) + (1+i)/2'),
      v('points de la droite x + y = 1 fixes', '-i*conj(x + i*(1-x)) + 1 + i', 'x + i*(1-x)'),
    ],
    'Ex3-4a': [
      v('S(A) = B', '(-1+i)*0 + 1', '1'),
      v('S(I) = A', '(-1+i)*(1+i)/2 + 1', '0'),
      v('rapport √2, angle 3π/4', '-1+i', 'sqrt(2)*exp(3*i*pi/4)'),
    ],
    'Ex3-4b': [
      v('centre Ω = (2 + i)/5 fixe', '(-1+i)*(2+i)/5 + 1', '(2+i)/5'),
      v('ΩM = AC/2 = 1/2', 'abs((2+i)/5 - i/2)', '1/2'),
      v('ΩL = IB/2 = √2/4', 'abs((2+i)/5 - (3+i)/4)', 'sqrt(2)/4'),
    ],
  },
};
