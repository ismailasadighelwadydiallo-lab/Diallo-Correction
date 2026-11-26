// Solveur mathématique local (sans Internet, sans IA) : comprend une demande courte en
// français ou en arabe, résout avec math.js, explique les étapes et VÉRIFIE le résultat par
// une méthode indépendante (substitution, dérivée numérique, valeurs approchées).
//
// Ce que le solveur sait faire : équations d'une variable (degré 1, 2 avec discriminant, 3,
// autres équations en valeurs approchées), dérivées (somme, produit, quotient, composée),
// limites (contrôle numérique), développer / simplifier / factoriser, calculs numériques.
// Ce qu'il ne fait PAS : primitives (math.js ne sait pas intégrer : il vérifie seulement une
// primitive proposée), démonstrations, physique, SVT. Il répond alors « Information insuffisante ».
import type { MathNode } from 'mathjs';
import { math, normaliser, parse, developper, variablesLibres, evaluerNombre, equivalentes } from '../math/engine.ts';

export type Tache = 'equation' | 'derivee' | 'limite' | 'developper' | 'factoriser' | 'simplifier' | 'calcul' | 'primitive';

/** Niveau de confiance, calculé avec des critères fixes (voir `confiance` plus bas). */
export type NiveauConfiance = 'elevee' | 'moyenne' | 'faible' | 'aucune';

export interface EtapeSolution {
  texte: string;
  /** Calcul de l'étape, écrit pour l'enseignant (notation lisible). */
  calcul?: string;
}

export interface Controle {
  quoi: string;
  ok: boolean;
  detail: string;
}

export interface SolutionCalculee {
  tache: Tache | null;
  /** Ce qui est demandé, reformulé. */
  comprendre: string;
  donnees: string[];
  methode: string;
  etapes: EtapeSolution[];
  /** Résultat final lisible. */
  resultat: string;
  /** Résultat machine (expression math.js, ou liste de valeurs), pour vérifier une copie. */
  resultatExpr?: string | string[];
  controles: Controle[];
  confiance: { niveau: NiveauConfiance; raisons: string[] };
}

// ---------------------------------------------------------------------------------------------
// Écriture lisible pour l'enseignant

const SUP: Record<string, string> = { '2': '²', '3': '³' };
export function joli(expr: string | MathNode): string {
  let s = typeof expr === 'string' ? expr : expr.toString({ parenthesis: 'auto', implicit: 'show' });
  s = s.replace(/\s*\^\s*/g, '^').replace(/\bexp\(/g, 'e^(').replace(/\s*\*\s*/g, '·').replace(/ - /g, ' − ').replace(/\^(\d)(?!\d)/g, (_, d) => SUP[d] ?? '^' + d)
    .replace(/\blog\(/g, 'ln(').replace(/\bsqrt\(/g, '√(').replace(/\bpi\b/g, 'π')
    .replace(/(\d)·([a-zA-Z(√])/g, '$1$2').replace(/\binf(inity)?\b/gi, '∞');
  return s;
}

const nombreJoli = (x: number) => {
  if (Number.isInteger(x)) return String(x);
  const f = fractionSimple(x);
  return f ?? String(Number(x.toPrecision(10))).replace('.', ',');
};
const par = (x: number) => (x < 0 ? `(${nombreJoli(x)})` : nombreJoli(x));
/** Reconnaît une fraction simple (dénominateur ≤ 24). */
function fractionSimple(x: number): string | null {
  for (let d = 2; d <= 24; d++) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-10) return `${n}/${d}`;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Compréhension de la demande

export interface Demande { tache: Tache | null; expression: string; variable?: string; vers?: string; membreDroit?: string }

/** Extrait la tâche et l'expression d'une demande courte (« Résous x² − 5x + 6 = 0 », « Dérive f(x) = x e^(2−x) »…). */
export function comprendreDemande(texte: string): Demande {
  const t = texte.trim();
  const bas = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const corps = () => {
    // ce qui suit « : », sinon ce qui suit le premier verbe
    let c = t.includes(':') ? t.slice(t.indexOf(':') + 1) : t.replace(/^\s*\S+\s+(la\s+|le\s+|l'|les\s+|de\s+)?(derivee|dérivée|limite|primitive|equation|équation)?\s*(de\s+)?/i, '');
    c = c.replace(/^\s*(dans\s+(r|ℝ|c|ℂ)\s*,?\s*)/i, '').trim();
    return c;
  };
  const sansNom = (e: string) => e.replace(/^\s*[a-zA-Z]\s*\(\s*([a-z])\s*\)\s*=\s*/, '').replace(/[.;]\s*$/, '').trim();

  if (/deriv|f'\(|مشتق/.test(bas)) {
    const e = sansNom(corps());
    return { tache: 'derivee', expression: e, variable: devinerVariable(e) };
  }
  if (/limite|\blim\b|نهاية/.test(bas)) {
    const m = /(?:en|quand\s+\w+\s+tend\s+vers|lorsque\s+\w+\s+tend\s+vers|→|->|vers)\s*([+-]?\s*(?:∞|inf(?:ini)?|\d+(?:[.,]\d+)?)\s*[+-]?)/i.exec(t);
    let e = corps().replace(/\s+(?:en|quand|lorsque|lorsqu'|→|->|tend)(?:\s|$).*$/i, '').replace(/\s*(?:→|->).*$/, '');
    e = sansNom(e.replace(/^(de\s+)/i, ''));
    let vers = m ? m[1].replace(/\s/g, '').replace(/infini|inf/i, 'inf').replace('∞', 'inf') : undefined;
    if (vers && /^inf$/.test(vers)) vers = '+inf';
    return { tache: 'limite', expression: e, variable: devinerVariable(e), vers };
  }
  if (/primitive|تكامل|دالة أصلية/.test(bas)) {
    const m = /primitive\s+(?:de\s+|d')?(.*)$/i.exec(t);
    const e = sansNom(m ? m[1] : corps());
    return { tache: 'primitive', expression: e, variable: devinerVariable(e) };
  }
  if (/factoris/.test(bas)) return { tache: 'factoriser', expression: sansNom(corps()), variable: devinerVariable(corps()) };
  if (/developp|développ/.test(bas)) return { tache: 'developper', expression: sansNom(corps()) };
  if (/simplifi/.test(bas)) return { tache: 'simplifier', expression: sansNom(corps()) };

  let c = /resou|resoudre|solve|حل|equation/.test(bas) ? corps() : t;
  if (/=/.test(c)) c = partieMath(c);
  if (/=/.test(c) && !/[<>]=?/.test(c)) {
    const [g, d] = c.split('=');
    return { tache: 'equation', expression: g.trim(), membreDroit: d.replace(/[.;]\s*$/, '').trim(), variable: devinerVariable(g + '+' + d) };
  }
  if (/calcul/.test(bas)) return { tache: 'calcul', expression: sansNom(corps()) };
  if (/^[\d\s+\-*/^().,×÷√π²³e]+$/.test(c)) return { tache: 'calcul', expression: sansNom(c) };
  return { tache: null, expression: t };
}

const FONCTIONS = new Set(['exp', 'ln', 'log', 'sin', 'cos', 'tan', 'sqrt']);
const motMath = (m: string) => {
  const nu = m.replace(/[.;:,]$/, '');
  if (!nu || !/^[\w^+\-*/().,²³√π=']+$/.test(nu)) return false;
  const lettres = nu.match(/[a-zA-Zàâçéèêëîïôûùüÿ]{2,}/g) ?? [];
  return lettres.every((l) => FONCTIONS.has(l.toLowerCase()) || /^[a-z]$/.test(l));
};

/** Garde seulement l'écriture mathématique autour du « = » (« Résoudre dans R l'équation x^2 = 4. » → « x^2 = 4 »). */
export function partieMath(t: string): string {
  const mots = t.split(/\s+/).filter(Boolean);
  const i = mots.findIndex((m) => m.includes('='));
  if (i < 0) return t;
  let a = i, b = i;
  while (a > 0 && motMath(mots[a - 1].replace(/^l'|^d'/i, ''))) a--;
  while (b < mots.length - 1 && motMath(mots[b + 1])) b++;
  if (a === i && /^l'|^d'/i.test(mots[i])) mots[i] = mots[i].replace(/^l'|^d'/i, '');
  else if (a < i && /^l'|^d'/i.test(mots[a])) mots[a] = mots[a].replace(/^l'|^d'/i, '');
  return mots.slice(a, b + 1).join(' ').replace(/[.;:,]\s*$/, '');
}

function devinerVariable(e: string): string | undefined {
  try {
    const v = variablesLibres(parse(e));
    return v.includes('x') ? 'x' : v[0];
  } catch { return undefined; }
}

// ---------------------------------------------------------------------------------------------
// Confiance : critères documentés (docs/confiance.md)
//  - élevée  : résultat obtenu par calcul exact ET confirmé par un contrôle indépendant ;
//  - moyenne : résultat approché (numérique) confirmé, ou contrôle numérique d'une limite ;
//  - faible  : un contrôle a échoué, ou aucun contrôle n'a été possible ;
//  - aucune  : la demande n'a pas été comprise (« Information insuffisante »).

function confiance(controles: Controle[], exact: boolean, raisons: string[] = []): SolutionCalculee['confiance'] {
  if (!controles.length) return { niveau: 'faible', raisons: [...raisons, 'aucun contrôle indépendant possible'] };
  if (controles.some((c) => !c.ok)) return { niveau: 'faible', raisons: [...raisons, 'un contrôle a échoué : vérification humaine recommandée'] };
  if (!exact) return { niveau: 'moyenne', raisons: [...raisons, 'résultat approché ou contrôle numérique (pas une démonstration)'] };
  return { niveau: 'elevee', raisons: [...raisons, 'calcul exact confirmé par un contrôle indépendant'] };
}

const insuffisant = (texte: string, pourquoi: string): SolutionCalculee => ({
  tache: null, comprendre: texte, donnees: [], methode: '', etapes: [], resultat: '⚠️ Information insuffisante',
  controles: [], confiance: { niveau: 'aucune', raisons: [pourquoi] },
});

// ---------------------------------------------------------------------------------------------

export function resoudre(texte: string): SolutionCalculee {
  let d: Demande;
  try { d = comprendreDemande(texte); } catch { return insuffisant(texte, 'demande non comprise'); }
  if (!d.tache) return insuffisant(texte, "je ne reconnais pas de calcul à faire (équation, dérivée, limite, développer, factoriser, calcul)");
  try {
    parse(d.expression);
    if (d.membreDroit !== undefined) parse(d.membreDroit);
  } catch {
    return insuffisant(texte, `expression illisible pour le moteur de calcul : « ${d.expression} »`);
  }
  if (d.tache === 'primitive') return {
    ...insuffisant(texte, "le moteur local ne sait pas calculer une primitive ; il peut seulement VÉRIFIER une primitive proposée (« Vérifier mon raisonnement »)"),
    tache: 'primitive', comprendre: `Trouver une primitive de ${joli(d.expression)}.`,
  };
  const libres = (() => { try { return variablesLibres(parse(d.expression + (d.membreDroit ? '+(' + d.membreDroit + ')' : ''))); } catch { return []; } })();
  if (libres.length > 1) return insuffisant(texte, `plusieurs inconnues (${libres.join(', ')}) : je ne sais traiter qu'une seule variable à la fois`);
  if (d.tache === 'calcul' && libres.length) return insuffisant(texte, `lettre inconnue « ${libres[0]} » dans un calcul numérique`);
  try {
    switch (d.tache) {
      case 'equation': return resoudreEquation(d.expression, d.membreDroit ?? '0', d.variable ?? 'x');
      case 'derivee': return deriver(d.expression, d.variable ?? 'x');
      case 'limite': return d.vers ? limite(d.expression, d.variable ?? 'x', d.vers) : insuffisant(texte, 'vers quoi tend la variable ? (ex. « en +∞ », « quand x tend vers 0 »)');
      case 'developper': case 'simplifier': return transformer(d.expression, d.tache);
      case 'factoriser': return factoriser(d.expression, d.variable ?? 'x');
      case 'calcul': return calculer(d.expression);
    }
  } catch (e) {
    return insuffisant(texte, 'calcul impossible : ' + (e as Error).message);
  }
}

// --- Équations -------------------------------------------------------------------------------

/** Coefficients si l'expression est un polynôme en `x` (degré ≤ 3), sinon null. Indice = degré. */
function coefficients(expr: string, x: string): number[] | null {
  try {
    const r = math.rationalize(developper(parse(expr)), {}, true) as unknown as { coefficients: number[]; variables: string[]; denominator?: unknown };
    if (r.variables.length > 1 || (r.variables.length === 1 && r.variables[0] !== x)) return null;
    if ((r as { denominator?: unknown }).denominator) return null;
    const c = r.coefficients.length ? r.coefficients.map(Number) : [evaluerNombre(expr) ?? NaN];
    if (c.some((v) => !Number.isFinite(v))) return null;
    while (c.length > 1 && c[c.length - 1] === 0) c.pop();
    return c.length <= 4 ? c : null;
  } catch { return null; }
}

function racineJolie(n: number): string {
  // √n simplifiée : √12 = 2√3
  if (n < 0) return 'i' + racineJolie(-n);
  const r = Math.sqrt(n);
  if (Number.isInteger(r)) return String(r);
  if (!Number.isInteger(n)) return `√${nombreJoli(n)}`;
  let a = 1, b = n;
  for (let k = Math.floor(Math.sqrt(n)); k > 1; k--) if (n % (k * k) === 0) { a = k; b = n / (k * k); break; }
  return a > 1 ? `${a}√${b}` : `√${n}`;
}

function verifierRacines(f: string, x: string, racines: (number | { re: number; im: number })[]): Controle {
  const c = developper(parse(f)).compile();
  const ecarts = racines.map((r) => {
    try {
      const v = c.evaluate({ [x]: typeof r === 'number' ? r : math.complex(r.re, r.im) });
      return typeof v === 'number' ? Math.abs(v) : Math.hypot((v as { re: number }).re, (v as { im: number }).im);
    } catch { return Infinity; }
  });
  const ok = ecarts.every((e) => e < 1e-8);
  return { quoi: 'Chaque solution remise dans l\'équation', ok, detail: ok ? 'toutes les solutions annulent l\'équation (écart < 10⁻⁸)' : `écarts : ${ecarts.map((e) => e.toExponential(1)).join(' ; ')}` };
}

function resoudreEquation(g: string, d: string, x: string): SolutionCalculee {
  const f = d.trim() === '0' ? g : `(${g}) - (${d})`;
  const comprendre = `Trouver toutes les valeurs de ${x} telles que ${joli(g)} = ${joli(d)}.`;
  const etapes: EtapeSolution[] = [];
  if (d.trim() !== '0') etapes.push({ texte: 'On ramène tout dans le membre de gauche.', calcul: `${joli(math.simplify(developper(parse(f))))} = 0` });
  const c = coefficients(f, x);
  if (c && c.length >= 2) {
    const deg = c.length - 1;
    if (deg === 1) {
      const [b, a] = c;
      const s = -b / a;
      etapes.push({ texte: 'Équation du premier degré : on isole ' + x + '.', calcul: `${nombreJoli(a)}${x} = ${nombreJoli(-b)}  ⇔  ${x} = ${nombreJoli(s)}` });
      const ctl = [verifierRacines(f, x, [s])];
      return { tache: 'equation', comprendre, donnees: [`${joli(g)} = ${joli(d)}`], methode: 'Équation du premier degré : isoler l\'inconnue.', etapes,
        resultat: `S = { ${nombreJoli(s)} }`, resultatExpr: [String(s)], controles: ctl, confiance: confiance(ctl, true) };
    }
    if (deg === 2) {
      const [cc, b, a] = c;
      const D = b * b - 4 * a * cc;
      etapes.push({ texte: `Équation du second degré a${x}² + b${x} + c = 0 avec a = ${nombreJoli(a)}, b = ${nombreJoli(b)}, c = ${nombreJoli(cc)}.` });
      etapes.push({ texte: 'On calcule le discriminant.', calcul: `Δ = b² − 4ac = ${par(b)}² − 4 × ${par(a)} × ${par(cc)} = ${nombreJoli(D)}` });
      let resultat: string, sol: (number | { re: number; im: number })[], expr: string[];
      if (D > 0) {
        const s1 = (-b - Math.sqrt(D)) / (2 * a), s2 = (-b + Math.sqrt(D)) / (2 * a);
        const exact = (sgn: string) => Number.isInteger(Math.sqrt(D)) ? nombreJoli(sgn === '-' ? s1 : s2) : `(${nombreJoli(-b)} ${sgn} ${racineJolie(D)}) / ${nombreJoli(2 * a)}`;
        etapes.push({ texte: 'Δ > 0 : deux solutions réelles.', calcul: `${x}₁ = (−b − √Δ) / 2a = ${exact('-')}   ;   ${x}₂ = (−b + √Δ) / 2a = ${exact('+')}` });
        resultat = `S = { ${exact('-')} ; ${exact('+')} }`;
        if (!Number.isInteger(Math.sqrt(D))) resultat += `  (≈ ${s1.toFixed(4).replace('.', ',')} ; ${s2.toFixed(4).replace('.', ',')})`;
        sol = [s1, s2]; expr = [String(s1), String(s2)];
      } else if (D === 0) {
        const s = -b / (2 * a);
        etapes.push({ texte: 'Δ = 0 : une solution double.', calcul: `${x}₀ = −b / 2a = ${nombreJoli(s)}` });
        resultat = `S = { ${nombreJoli(s)} }`; sol = [s]; expr = [String(s)];
      } else {
        const re = -b / (2 * a), im = Math.sqrt(-D) / (2 * Math.abs(a));
        etapes.push({ texte: 'Δ < 0 : pas de solution réelle ; dans ℂ, deux solutions conjuguées.', calcul: `${x} = (−b ± i√(−Δ)) / 2a = ${nombreJoli(re)} ± ${nombreJoli(im)}i` });
        resultat = `Dans ℝ : S = ∅.  Dans ℂ : S = { ${nombreJoli(re)} − ${nombreJoli(im)}i ; ${nombreJoli(re)} + ${nombreJoli(im)}i }`;
        sol = [{ re, im: -im }, { re, im }]; expr = [`${re} - ${im}i`, `${re} + ${im}i`];
      }
      const ctl = [verifierRacines(f, x, sol)];
      return { tache: 'equation', comprendre, donnees: [`${joli(g)} = ${joli(d)}`], methode: 'Équation du second degré : méthode du discriminant.', etapes, resultat, resultatExpr: expr, controles: ctl, confiance: confiance(ctl, true) };
    }
    if (deg === 3) {
      const r = math.polynomialRoot(c[0], c[1], c[2], c[3]) as (number | { re: number; im: number })[];
      const reels = r.filter((v): v is number => typeof v === 'number').sort((p, q) => p - q);
      const cplx = r.filter((v) => typeof v !== 'number') as { re: number; im: number }[];
      etapes.push({ texte: 'Équation du troisième degré : on cherche une racine évidente, puis on factorise. Le moteur calcule directement les racines (formule de Cardan).' });
      const ent = reels.find((v) => Number.isInteger(Math.round(v * 1e9) / 1e9));
      if (ent !== undefined) etapes.push({ texte: `Racine évidente : ${x} = ${nombreJoli(Math.round(ent))}.`, calcul: `on factorise par (${x} − ${nombreJoli(Math.round(ent))})` });
      const resultat = `Dans ℝ : S = { ${reels.map(nombreJoli).join(' ; ')} }` + (cplx.length ? `  ;  dans ℂ, en plus : ${cplx.map((z) => `${nombreJoli(z.re)} ${z.im < 0 ? '−' : '+'} ${nombreJoli(Math.abs(z.im))}i`).join(' ; ')}` : '');
      const ctl = [verifierRacines(f, x, r)];
      const exact = reels.every((v) => fractionSimple(v) !== null || Number.isInteger(v));
      return { tache: 'equation', comprendre, donnees: [`${joli(g)} = ${joli(d)}`], methode: 'Équation du troisième degré : racine évidente puis factorisation.', etapes, resultat, resultatExpr: reels.map(String), controles: ctl, confiance: confiance(ctl, exact) };
    }
  }
  // Autres équations : recherche numérique des solutions dans [−50 ; 50].
  const h = developper(parse(f)).compile();
  const val = (t: number) => { try { const v = h.evaluate({ [x]: t }); return typeof v === 'number' && Number.isFinite(v) ? v : null; } catch { return null; } };
  const sols: number[] = [];
  const N = 20000, A = -50, B = 50;
  let prevX = A, prevY = val(A);
  for (let k = 1; k <= N; k++) {
    const t = A + ((B - A) * k) / N, y = val(t);
    if (y !== null && prevY !== null) {
      if (y === 0) sols.push(t);
      else if (prevY * y < 0) {
        let lo = prevX, hi = t, ylo = prevY;
        for (let it = 0; it < 80; it++) { const m = (lo + hi) / 2, ym = val(m); if (ym === null) break; if (ylo * ym <= 0) hi = m; else { lo = m; ylo = ym; } }
        const r = (lo + hi) / 2;
        if (Math.abs(val(r) ?? Infinity) < 1e-6) sols.push(r);
      }
    }
    prevX = t; prevY = y;
  }
  const uniques = sols.filter((s, i) => i === 0 || Math.abs(s - sols[i - 1]) > 1e-7).map((s) => (Math.abs(s - Math.round(s)) < 1e-9 ? Math.round(s) : s));
  etapes.push({ texte: `Ce n'est pas une équation polynomiale de degré ≤ 3 : le moteur cherche les solutions par calcul approché sur [−50 ; 50] (changements de signe, puis dichotomie).` });
  if (!uniques.length) {
    return { tache: 'equation', comprendre, donnees: [`${joli(g)} = ${joli(d)}`], methode: 'Recherche numérique des solutions.', etapes,
      resultat: '⚠️ Aucune solution trouvée sur [−50 ; 50] (il peut en exister ailleurs, ou des solutions doubles non détectées).', controles: [],
      confiance: { niveau: 'faible', raisons: ['recherche numérique sans résultat : vérification humaine recommandée'] } };
  }
  const ctl = [verifierRacines(f, x, uniques).ok
    ? { quoi: 'Chaque solution remise dans l\'équation', ok: true, detail: 'écart < 10⁻⁶ (valeurs approchées)' }
    : verifierRacines(f, x, uniques)];
  ctl[0].ok = uniques.every((s) => Math.abs(val(s) ?? Infinity) < 1e-6);
  return { tache: 'equation', comprendre, donnees: [`${joli(g)} = ${joli(d)}`], methode: 'Recherche numérique des solutions (valeurs approchées).', etapes,
    resultat: `S ≈ { ${uniques.map((s) => (Number.isInteger(s) ? String(s) : s.toFixed(6).replace('.', ','))).join(' ; ')} } sur [−50 ; 50]`, resultatExpr: uniques.map(String),
    controles: ctl, confiance: confiance(ctl, false, ['solutions cherchées seulement sur [−50 ; 50]']) };
}

/** Racines réelles de f(x) = 0 : exactes pour un polynôme de degré ≤ 3, sinon approchées sur [−50 ; 50]. */
export function racinesReelles(f: string, x: string): { racines: number[]; exact: boolean } {
  const c = coefficients(f, x);
  if (c && c.length >= 2 && c.length <= 4) {
    const r = c.length === 2 ? [-c[0] / c[1]] : (math.polynomialRoot(...(c as [number, number])) as (number | object)[]).filter((v): v is number => typeof v === 'number');
    const u = [...new Set(r.map((v) => Math.round(v * 1e9) / 1e9))].sort((a, b) => a - b);
    return { racines: u, exact: true };
  }
  const h = developper(parse(f)).compile();
  const val = (t: number) => { try { const v = h.evaluate({ [x]: t }); return typeof v === 'number' && Number.isFinite(v) ? v : null; } catch { return null; } };
  const sols: number[] = [];
  const N = 20000, A = -50, B = 50;
  let prevX = A, prevY = val(A);
  for (let k = 1; k <= N; k++) {
    const t = A + ((B - A) * k) / N, y = val(t);
    if (y !== null && prevY !== null) {
      if (y === 0) sols.push(t);
      else if (prevY * y < 0) {
        let lo = prevX, hi = t, ylo = prevY;
        for (let it = 0; it < 80; it++) { const m = (lo + hi) / 2, ym = val(m); if (ym === null) break; if (ylo * ym <= 0) hi = m; else { lo = m; ylo = ym; } }
        const r = (lo + hi) / 2;
        if (Math.abs(val(r) ?? Infinity) < 1e-6) sols.push(r);
      }
    }
    prevX = t; prevY = y;
  }
  return { racines: sols.filter((v, i) => i === 0 || Math.abs(v - sols[i - 1]) > 1e-7).map((v) => (Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v)), exact: false };
}

// --- Dérivées --------------------------------------------------------------------------------

const estConstante = (n: MathNode, x: string) => !variablesLibres(n).includes(x);

function regleDerivation(n: MathNode, x: string): EtapeSolution[] {
  const e: EtapeSolution[] = [];
  const d = (m: MathNode) => joli(math.simplify(math.derivative(m, x)));
  const op = n as unknown as { type: string; op?: string; fn?: string | { name: string }; args?: MathNode[]; content?: MathNode };
  if (op.type === 'ParenthesisNode') return regleDerivation(op.content!, x);
  if (op.type === 'OperatorNode' && op.args?.length === 2) {
    const [u, v] = op.args;
    if (op.op === '+' || op.op === '-') e.push({ texte: `Dérivée d'une somme : (u ${op.op} v)' = u' ${op.op} v'.`, calcul: `u = ${joli(u)}, u' = ${d(u)} ; v = ${joli(v)}, v' = ${d(v)}` });
    else if (op.op === '*' && !estConstante(u, x) && !estConstante(v, x)) e.push({ texte: "Dérivée d'un produit : (u·v)' = u'·v + u·v'.", calcul: `u = ${joli(u)}, u' = ${d(u)} ; v = ${joli(v)}, v' = ${d(v)}` });
    else if (op.op === '*') e.push({ texte: "Constante fois une fonction : (k·u)' = k·u'." });
    else if (op.op === '/' && !estConstante(v, x)) e.push({ texte: "Dérivée d'un quotient : (u/v)' = (u'·v − u·v') / v².", calcul: `u = ${joli(u)}, u' = ${d(u)} ; v = ${joli(v)}, v' = ${d(v)}` });
    else if (op.op === '^' && estConstante(v, x) && !estConstante(u, x)) e.push({ texte: "Dérivée d'une puissance : (uⁿ)' = n·u'·uⁿ⁻¹.", calcul: `u = ${joli(u)}, u' = ${d(u)}, n = ${joli(v)}` });
    else if (op.op === '^' && !estConstante(v, x)) e.push({ texte: "Exposant variable : on écrit a^v = e^(v·ln a), puis (e^w)' = w'·e^w." });
  } else if (op.type === 'FunctionNode' && op.args?.length === 1) {
    const nom = typeof op.fn === 'string' ? op.fn : op.fn!.name;
    const u = op.args[0];
    const simple = u.type === 'SymbolNode';
    const formules: Record<string, string> = { exp: "(e^u)' = u'·e^u", log: "(ln u)' = u'/u", sqrt: "(√u)' = u'/(2√u)", sin: "(sin u)' = u'·cos u", cos: "(cos u)' = −u'·sin u", tan: "(tan u)' = u'·(1 + tan² u)" };
    if (formules[nom] && !simple) e.push({ texte: `Fonction composée : ${formules[nom]}.`, calcul: `u = ${joli(u)}, u' = ${d(u)}` });
    else if (formules[nom]) e.push({ texte: `Dérivée usuelle : ${formules[nom].replace(/u'·|u'\//g, (m) => (m === "u'/" ? '1/' : '')).replace(/\bu\b/g, x)}.` });
  }
  return e;
}

/** Dérivée numérique (différence centrée) : contrôle indépendant du calcul symbolique. */
function controleDerivee(f: string, fp: string, x: string): Controle {
  const cf = developper(parse(f)).compile(), cd = developper(parse(fp)).compile();
  let n = 0, pire = 0;
  for (const t of [-2.3, -1.1, -0.4, 0.35, 0.8, 1.7, 2.9, 4.2, 0.05, 3.3]) {
    try {
      const h = 1e-5 * Math.max(1, Math.abs(t));
      const a = cf.evaluate({ [x]: t + h }), b = cf.evaluate({ [x]: t - h }), y = cd.evaluate({ [x]: t });
      if (![a, b, y].every((v) => typeof v === 'number' && Number.isFinite(v))) continue;
      const num = (a - b) / (2 * h);
      pire = Math.max(pire, Math.abs(num - y) / Math.max(1, Math.abs(y)));
      n++;
    } catch { /* hors domaine */ }
  }
  const ok = n >= 4 && pire < 1e-4;
  return { quoi: 'Dérivée comparée à un calcul approché (taux d\'accroissement)', ok, detail: n < 4 ? 'trop peu de points où la fonction est définie' : `écart relatif maximal ${pire.toExponential(1)} sur ${n} points` };
}

/** e^(w) → exp(w), pour que math.js dérive et simplifie proprement. */
function versExp(n: MathNode): MathNode {
  return n.transform((m: MathNode) => {
    const o = m as unknown as { type: string; op?: string; args?: MathNode[] };
    if (o.type === 'OperatorNode' && o.op === '^' && (o.args![0] as unknown as { name?: string }).name === 'e') return new math.FunctionNode('exp', [versExp(o.args![1])]);
    return m;
  });
}

function deriver(expr: string, x: string): SolutionCalculee {
  const n = versExp(developper(parse(expr)));
  const brut = math.derivative(n, x);
  const simp = math.simplify(brut);
  const etapes = regleDerivation(n, x);
  etapes.push({ texte: 'On calcule et on simplifie.', calcul: `${x === 'x' ? "f'(x)" : `f'(${x})`} = ${joli(simp)}` });
  // forme factorisée par l'exponentielle si elle apparaît (présentation du Bac : (1 − x)e^(2−x))
  const fact = factoriserExp(simp, x);
  if (fact) etapes.push({ texte: 'Forme factorisée (utile pour le signe de la dérivée).', calcul: `f'(${x}) = ${joli(fact)}` });
  const ctl = [controleDerivee(expr, simp.toString(), x)];
  return { tache: 'derivee', comprendre: `Calculer la dérivée de f(${x}) = ${joli(expr)}.`, donnees: [`f(${x}) = ${joli(expr)}`],
    methode: etapes[0]?.texte.split(':')[0] ?? 'Dérivées usuelles.', etapes,
    resultat: `f'(${x}) = ${joli(fact ?? simp)}`, resultatExpr: (fact ?? simp).toString(), controles: ctl, confiance: confiance(ctl, true) };
}

function factoriserExp(n: MathNode, x: string): MathNode | null {
  // Cherche un facteur e^(…) commun : f' = P(x)·e^(w) ; on vérifie l'égalité numériquement.
  let w: MathNode | null = null;
  n.traverse((m: MathNode) => { const f = m as unknown as { type: string; fn?: { name: string }; name?: string; op?: string; args?: MathNode[] };
    if (!w && f.type === 'FunctionNode' && f.fn?.name === 'exp') w = f.args![0];
    if (!w && f.type === 'OperatorNode' && f.op === '^' && (f.args![0] as unknown as { name?: string }).name === 'e') w = f.args![1]; });
  if (!w) return null;
  try {
    const P = math.simplify(new math.OperatorNode('/', 'divide', [n, new math.FunctionNode('exp', [w])]));
    if (P.toString().includes('exp') || /\be\s*\^/.test(P.toString())) return null;
    const res = new math.OperatorNode('*', 'multiply', [new math.ParenthesisNode(P), new math.FunctionNode('exp', [w])]);
    return equivalentes(res, n) && estConstante(P, 'e') ? res : null;
  } catch { return null; }
}

// --- Limites ---------------------------------------------------------------------------------

function limite(expr: string, x: string, vers: string): SolutionCalculee {
  const f = developper(parse(expr)).compile();
  const v = vers.replace(/\s/g, '').replace('∞', 'inf');
  let suite: number[];
  if (v === '+inf') suite = [10, 100, 1000, 1e4, 1e5];
  else if (v === '-inf') suite = [-10, -100, -1000, -1e4, -1e5];
  else {
    const m = /^(.+?)([+-])?$/.exec(v)!;
    const a = evaluerNombre(m[1]);
    if (a === null) return insuffisant(expr, `point « ${vers} » non compris`);
    const cote = m[2] === '-' ? -1 : 1;
    suite = [1e-1, 1e-2, 1e-3, 1e-4, 1e-5].map((h) => a + cote * h);
  }
  const ys = suite.map((t) => { try { const y = f.evaluate({ [x]: t }); return typeof y === 'number' ? y : NaN; } catch { return NaN; } });
  const tableau = suite.map((t, k) => `f(${nombreJoli(t)}) ≈ ${Number.isFinite(ys[k]) ? Number(ys[k].toPrecision(6)) : '∞'}`).join(' ; ');
  const fin = ys.filter((y) => !Number.isNaN(y));
  const etapes: EtapeSolution[] = [{ texte: 'Le moteur calcule f pour des valeurs de plus en plus proches du point (contrôle numérique).', calcul: tableau }];
  let resultat: string, ok = false;
  const dernier = fin[fin.length - 1];
  if (fin.length < 4) resultat = '⚠️ Information insuffisante (fonction non définie près du point)';
  else if (!Number.isFinite(dernier) || Math.abs(dernier) > 1e6) {
    const signe = (Number.isFinite(dernier) ? dernier : ys.find((y) => Number.isFinite(y)) ?? 1) > 0 ? '+∞' : '−∞';
    ok = fin.slice(1).every((y, k) => (signe === '+∞' ? y >= fin[k] : y <= fin[k]) || !Number.isFinite(y));
    resultat = ok ? `lim f = ${signe}` : '⚠️ Les valeurs ne se stabilisent pas : vérification humaine recommandée';
  } else {
    const L = dernier, ecart = Math.abs(fin[fin.length - 1] - fin[fin.length - 2]);
    ok = ecart < 1e-3 * Math.max(1, Math.abs(L));
    // valeur « reconnue » : nombre simple (entier ou fraction) vers lequel les valeurs se rapprochent
    let propre: number | string = Number(L.toPrecision(6));
    for (let d = 1; d <= 24; d++) {
      const n = Math.round(L * d);
      if (Math.abs(n / d - L) < 1e-3 * Math.max(1, Math.abs(L)) && Math.abs(n / d - fin[fin.length - 1]) <= Math.abs(n / d - fin[0])) { propre = d === 1 ? n : `${n}/${d}`; break; }
    }
    resultat = ok ? `lim f = ${String(propre).replace('.', ',')}` : '⚠️ Les valeurs ne se stabilisent pas : vérification humaine recommandée';
  }
  etapes.push({ texte: "⚠️ C'est une estimation : au Bac, il faut la justifier (croissances comparées, factorisation, forme indéterminée…). La rédaction reste à faire par le correcteur." });
  const ctl: Controle[] = [{ quoi: 'Stabilité des valeurs calculées', ok, detail: tableau }];
  return { tache: 'limite', comprendre: `Calculer la limite de f(${x}) = ${joli(expr)} quand ${x} tend vers ${vers.replace('inf', '∞')}.`, donnees: [`f(${x}) = ${joli(expr)}`],
    methode: 'Estimation numérique de la limite (pas une démonstration).', etapes, resultat, controles: ctl, confiance: confiance(ctl, false) };
}

// --- Développer, simplifier, factoriser, calculer --------------------------------------------

function transformer(expr: string, tache: 'developper' | 'simplifier'): SolutionCalculee {
  const n = developper(parse(expr));
  let r: MathNode;
  if (tache === 'developper') {
    try { r = (math.rationalize(n, {}, true) as unknown as { expression: MathNode }).expression; } catch { r = math.simplify(n); }
  } else r = math.simplify(n);
  const ctl: Controle[] = [{ quoi: "Égalité avec l'expression de départ (valeurs en plusieurs points)", ok: equivalentes(n, r), detail: `${joli(expr)} et ${joli(r)}` }];
  return { tache, comprendre: `${tache === 'developper' ? 'Développer et réduire' : 'Simplifier'} ${joli(expr)}.`, donnees: [joli(expr)],
    methode: tache === 'developper' ? 'Distributivité, puis regroupement des termes de même degré.' : 'Simplification algébrique.',
    etapes: [{ texte: 'Résultat du calcul.', calcul: `${joli(expr)} = ${joli(r)}` }], resultat: joli(r), resultatExpr: r.toString(), controles: ctl, confiance: confiance(ctl, true) };
}

function factoriser(expr: string, x: string): SolutionCalculee {
  const c = coefficients(expr, x);
  if (!c || c.length !== 3) return { ...transformer(expr, 'simplifier'), tache: 'factoriser', confiance: { niveau: 'faible', raisons: ['factorisation automatique seulement pour le second degré : vérification humaine recommandée'] } };
  const eq = resoudreEquation(expr, '0', x);
  const [cc, b, a] = c;
  const D = b * b - 4 * a * cc;
  let res: string;
  if (D < 0) res = `${joli(expr)} (pas de racine réelle : ne se factorise pas dans ℝ)`;
  else {
    const r = (eq.resultatExpr as string[]).map(Number);
    const terme = (v: number) => (v === 0 ? x : v < 0 ? `(${x} + ${nombreJoli(-v)})` : `(${x} − ${nombreJoli(v)})`);
    res = `${a === 1 ? '' : a === -1 ? '−' : nombreJoli(a)}${r.length === 1 ? terme(r[0]) + '²' : terme(r[0]) + terme(r[1])}`;
  }
  return { ...eq, tache: 'factoriser', comprendre: `Factoriser ${joli(expr)}.`, methode: 'Racines du trinôme, puis a(x − x₁)(x − x₂).',
    etapes: [...eq.etapes, { texte: 'Forme factorisée : a(x − x₁)(x − x₂).', calcul: res }], resultat: res };
}

function calculer(expr: string): SolutionCalculee {
  const v = developper(parse(expr)).evaluate();
  const txt = typeof v === 'number' ? nombreJoli(v) : math.format(v, { precision: 10 });
  const ctl: Controle[] = [];
  return { tache: 'calcul', comprendre: `Calculer ${joli(expr)}.`, donnees: [], methode: 'Calcul direct.', etapes: [{ texte: 'Calcul.', calcul: `${joli(expr)} = ${txt}` }],
    resultat: txt, resultatExpr: String(v), controles: ctl, confiance: { niveau: 'elevee', raisons: ['calcul direct par le moteur (pas de contrôle séparé nécessaire)'] } };
}

export { normaliser };
