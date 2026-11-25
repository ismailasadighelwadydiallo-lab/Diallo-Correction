// Vérification mathématique avec math.js (Apache-2.0).
// Comparaison d'expressions par évaluation numérique sur des points tirés (déterministes),
// nombres complexes et matrices, dérivée symbolique avec diff(f, x[, n]),
// racines, primitives, limites (contrôle numérique) et inégalités sur un domaine.
import { create, all, type MathNode, type MathJsInstance } from 'mathjs';
import type { Verification } from '../pack/types.ts';

const math: MathJsInstance = create(all, {});

const CONSTANTES = new Set(['e', 'E', 'pi', 'PI', 'i', 'Infinity', 'NaN', 'true', 'false', 'phi', 'tau']);

/** Normalise une écriture d'élève ou de corrigé : virgule décimale, ×, −, ², √, ln, ** … */
export function normaliser(s: string): string {
  // virgule décimale (« 2,5 »), sauf dans une matrice ou un vecteur ([1,2,3])
  const t = s.includes('[') ? s.trim() : s.trim().replace(/(\d),(\d)/g, '$1.$2');
  return t
    .replace(/\*\*/g, '^')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([0-9a-zA-Z.]+)/g, 'sqrt($1)')
    .replace(/π/g, 'pi')
    .replace(/θ/g, 'theta')
    .replace(/\bln\s*\(/g, 'log(');
}

export function parse(expr: string | number): MathNode {
  return math.parse(normaliser(String(expr)));
}

/** Remplace les variables du scope (récursivement) et développe diff(f, x) ou diff(f, x, n). */
export function developper(node: MathNode, scope: Record<string, MathNode> = {}): MathNode {
  const rec = (n: MathNode): MathNode =>
    n.transform((m: MathNode) => {
      if (m.type === 'SymbolNode') {
        const name = (m as unknown as { name: string }).name;
        if (scope[name]) return new math.ParenthesisNode(rec(scope[name]));
        return m;
      }
      if (m.type === 'FunctionNode') {
        const f = m as unknown as { fn: { name?: string }; args: MathNode[] };
        if (f.fn.name === 'diff') {
          if (f.args.length < 2 || f.args.length > 3 || f.args[1].type !== 'SymbolNode') throw new Error('diff(f, x) ou diff(f, x, n) attendu');
          const v = (f.args[1] as unknown as { name: string }).name;
          const ordre = f.args[2] ? Number(f.args[2].evaluate()) : 1;
          if (!Number.isInteger(ordre) || ordre < 1 || ordre > 5) throw new Error('ordre de dérivation entre 1 et 5');
          let d = rec(f.args[0]);
          for (let k = 0; k < ordre; k++) d = math.derivative(d, v);
          return d;
        }
        // On parcourt les arguments, mais pas le nom de la fonction.
        const args = f.args.map(rec);
        return new math.FunctionNode(f.fn as never, args);
      }
      return m;
    });
  return rec(node);
}

export function variablesLibres(node: MathNode): string[] {
  const s = new Set<string>();
  const fnNames = new Set<string>();
  node.traverse((n: MathNode) => {
    if (n.type === 'FunctionNode') {
      const fn = (n as unknown as { fn: { name?: string } }).fn;
      if (fn.name) fnNames.add(fn.name);
    }
  });
  node.traverse((n: MathNode) => {
    if (n.type === 'SymbolNode') {
      const name = (n as unknown as { name: string }).name;
      if (!CONSTANTES.has(name) && !fnNames.has(name)) s.add(name);
    }
  });
  return [...s].sort();
}

// Générateur pseudo-aléatoire déterministe (mêmes points à chaque exécution).
function* points(n: number, nv: number): Generator<number[]> {
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let k = 0; k < n; k++) {
    // un tiers positifs (domaines de ln, sqrt), un tiers dans [-3, 3], un tiers dans [0, 1]
    yield Array.from({ length: nv }, () => (k % 3 === 1 ? 0.2 + rnd() * 3.3 : k % 3 === 2 ? rnd() : -3 + rnd() * 6));
  }
}

type C = { re: number; im: number };

/** Valeur numérique (réelle, complexe, ou tableau/matrice aplati) ; null si non numérique. */
function valeurs(v: unknown): C[] | null {
  if (typeof v === 'number') return Number.isFinite(v) ? [{ re: v, im: 0 }] : null;
  if (typeof v === 'boolean') return [{ re: v ? 1 : 0, im: 0 }];
  if (v && typeof v === 'object') {
    if ('re' in v && 'im' in v) {
      const c = v as C;
      return Number.isFinite(c.re) && Number.isFinite(c.im) ? [{ re: c.re, im: c.im }] : null;
    }
    if ('toArray' in v) return valeurs((v as { toArray: () => unknown }).toArray());
    if (Array.isArray(v)) {
      const out: C[] = [];
      for (const x of v.flat(Infinity)) { const c = valeurs(x); if (!c) return null; out.push(...c); }
      return out;
    }
    if ('toNumber' in v) {
      try { return valeurs((v as { toNumber: () => number }).toNumber()); } catch { return null; }
    }
  }
  return null;
}

function reel(v: unknown): number | null {
  const c = valeurs(v);
  return c && c.length === 1 && Math.abs(c[0].im) < 1e-12 ? c[0].re : null;
}

export function evaluerNombre(node: MathNode | string, scope: Record<string, number> = {}): number | null {
  try {
    const n = typeof node === 'string' ? developper(parse(node)) : node;
    return reel(n.compile().evaluate({ ...scope }));
  } catch {
    return null;
  }
}

export const procheNombre = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const procheC = (a: C, b: C, tol: number) => Math.hypot(a.re - b.re, a.im - b.im) <= tol * Math.max(1, Math.hypot(a.re, a.im), Math.hypot(b.re, b.im));
const estReel = (c: C[]) => c.every((x) => Math.abs(x.im) < 1e-12);

/**
 * Deux expressions sont-elles équivalentes ? Vrai si elles donnent la même valeur
 * sur au moins 4 points où les deux sont définies (et aucun point en désaccord).
 * Fonctionne aussi pour des nombres complexes et des matrices. Un point où l'une est
 * réelle et l'autre complexe est ignoré (question de domaine, ex. ln(x²) et 2 ln x).
 */
export function equivalentes(a: MathNode | string, b: MathNode | string, tol = 1e-6): boolean {
  try {
    const na = typeof a === 'string' ? developper(parse(a)) : developper(a);
    const nb = typeof b === 'string' ? developper(parse(b)) : developper(b);
    const vars = [...new Set([...variablesLibres(na), ...variablesLibres(nb)])];
    const ca = na.compile(), cb = nb.compile();
    const eval_ = (c: ReturnType<MathNode['compile']>, s: Record<string, number>) => { try { return valeurs(c.evaluate({ ...s })); } catch { return null; } };
    const egaux = (x: C[], y: C[]) => x.length === y.length && x.every((v, k) => procheC(v, y[k], tol));
    if (vars.length === 0) {
      const x = eval_(ca, {}), y = eval_(cb, {});
      return !!x && !!y && egaux(x, y);
    }
    let accords = 0;
    for (const p of points(30, vars.length)) {
      const scope = Object.fromEntries(vars.map((v, i) => [v, p[i]]));
      const x = eval_(ca, scope), y = eval_(cb, scope);
      if (!x || !y) continue;
      if (estReel(x) !== estReel(y)) continue;
      if (!egaux(x, y)) return false;
      accords++;
    }
    return accords >= 4;
  } catch {
    return false;
  }
}

/** Contrôle numérique d'une limite (indice fort, pas une preuve). */
export function limiteNumerique(expr: string, variable: string, vers: string, attendu: string): { ok: boolean; detail: string } {
  const f = developper(parse(expr)).compile();
  const v = vers.replace(/\s/g, '');
  let suite: number[];
  const infini = (signe: number) => {
    // grandes valeurs ; si l'expression déborde (exp), valeurs plus modérées
    const grand = [1e2, 1e3, 1e4, 1e5, 1e6].map((x) => signe * x);
    return grand.every((x) => { try { return reel(f.evaluate({ [variable]: x })) !== null; } catch { return false; } }) ? grand : [10, 30, 100, 300, 600].map((x) => signe * x);
  };
  if (v === '+inf' || v === '+∞') suite = infini(1);
  else if (v === '-inf' || v === '-∞') suite = infini(-1);
  else {
    const m = /^(.+?)([+-])?$/.exec(v)!;
    const a = evaluerNombre(m[1])!;
    const cote = m[2] === '-' ? -1 : 1;
    suite = [1e-2, 1e-3, 1e-4, 1e-5, 1e-6].map((h) => a + cote * h);
  }
  const ys = suite.map((x) => { try { return reel(f.evaluate({ [variable]: x })); } catch { return null; } });
  if (ys.some((y) => y === null)) return { ok: false, detail: `non définie près de ${vers}` };
  const y = ys as number[];
  const last = y[y.length - 1];
  const att = attendu.replace(/\s/g, '');
  let ok: boolean;
  if (att === '+inf' || att === '+∞') ok = last > 1e5 && y.every((t, k) => k === 0 || t >= y[k - 1]);
  else if (att === '-inf' || att === '-∞') ok = last < -1e5 && y.every((t, k) => k === 0 || t <= y[k - 1]);
  else {
    const L = evaluerNombre(attendu)!;
    ok = Math.abs(last - L) < 1e-3 * Math.max(1, Math.abs(L)) && Math.abs(last - L) <= Math.abs(y[0] - L) + 1e-12;
  }
  return { ok, detail: `${expr} quand ${variable} → ${vers} : ${y.map((t) => Number(t.toPrecision(6))).join(' ; ')} ⇒ ${ok ? '' : 'pas '}${attendu}` };
}

/** Une condition (booléenne) est-elle vraie partout où le domaine est respecté ? */
export function toujoursVrai(condition: string, domaine?: string): { ok: boolean; detail: string } {
  const c = developper(parse(condition)).compile();
  const d = domaine ? developper(parse(domaine)).compile() : null;
  const vars = [...new Set([...variablesLibres(parse(condition)), ...(domaine ? variablesLibres(parse(domaine)) : [])])];
  let n = 0;
  for (const p of points(150, vars.length)) {
    const s = Object.fromEntries(vars.map((v, i) => [v, p[i]]));
    try {
      if (d && !d.evaluate({ ...s })) continue;
      const r = c.evaluate({ ...s });
      if (typeof r !== 'boolean') return { ok: false, detail: 'la condition ne donne pas vrai/faux' };
      if (!r) return { ok: false, detail: `fausse pour ${JSON.stringify(s)}` };
      n++;
    } catch { /* point hors domaine */ }
  }
  return { ok: n >= 8, detail: `vraie sur ${n} points tirés${domaine ? ' avec ' + domaine : ''}` };
}

export interface ResultatVerification {
  ok: boolean;
  detail: string;
}

/** Exécute une vérification déclarée dans un pack. */
export function verifier(v: Verification): ResultatVerification {
  const type = v.type ?? (v.valeurs ? 'racines' : 'egal');
  try {
    if (type === 'egal') {
      if (v.egal_a === undefined) return { ok: false, detail: `egal_a manquant (rien à comparer pour ${v.expression})` };
      const ok = equivalentes(v.expression, v.egal_a);
      return { ok, detail: ok ? `${v.expression} = ${v.egal_a}` : `${v.expression} ≠ ${v.egal_a}` };
    }
    if (type === 'racines') {
      const f = developper(parse(v.expression));
      const vars = variablesLibres(f);
      const x = v.variable ?? vars[0] ?? 'x';
      const mauvaises = (v.valeurs ?? []).filter((r) => {
        try {
          const val = developper(parse(String(r))).evaluate();
          const y = valeurs(f.compile().evaluate({ [x]: val }));
          return !y || y.some((c) => Math.hypot(c.re, c.im) > 1e-9);
        } catch { return true; }
      });
      const ok = mauvaises.length === 0 && (v.valeurs ?? []).length > 0;
      return { ok, detail: ok ? `${(v.valeurs ?? []).join(' ; ')} annulent ${v.expression}` : `ne sont pas racines : ${mauvaises.join(' ; ')}` };
    }
    if (type === 'primitive') {
      if (v.egal_a === undefined) return { ok: false, detail: 'egal_a manquant' };
      const x = v.variable ?? 'x';
      const ok = equivalentes(`diff(${v.egal_a}, ${x})`, v.expression);
      return { ok, detail: ok ? `(${v.egal_a})' = ${v.expression}` : `(${v.egal_a})' ≠ ${v.expression}` };
    }
    if (type === 'limite') {
      if (!v.vers || v.egal_a === undefined) return { ok: false, detail: 'vers et egal_a requis' };
      return limiteNumerique(v.expression, v.variable ?? 'x', v.vers, v.egal_a);
    }
    if (type === 'vrai') return toujoursVrai(v.expression, v.domaine);
    return { ok: false, detail: `type inconnu ${type}` };
  } catch (e) {
    return { ok: false, detail: 'erreur : ' + (e as Error).message };
  }
}

export { math };
