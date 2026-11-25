// Vérification mathématique avec math.js (Apache-2.0).
// Comparaison d'expressions par évaluation numérique sur des points tirés (déterministes),
// dérivée symbolique avec diff(f, x), vérification de racines et de primitives.
import { create, all, type MathNode, type MathJsInstance } from 'mathjs';
import type { Verification } from '../pack/types.ts';

const math: MathJsInstance = create(all, {});
// ln(x) = logarithme népérien (notation française), log(x) reste népérien comme dans math.js.
math.import({ ln: (x: number) => Math.log(x) }, { override: false });

const CONSTANTES = new Set(['e', 'E', 'pi', 'PI', 'i', 'Infinity', 'NaN', 'true', 'false', 'phi', 'tau']);

/** Normalise une écriture d'élève ou de corrigé : virgule décimale, ×, −, ², √, ln… */
export function normaliser(s: string): string {
  return s
    .trim()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([0-9a-zA-Z.]+)/g, 'sqrt($1)')
    .replace(/π/g, 'pi');
}

export function parse(expr: string | number): MathNode {
  return math.parse(normaliser(String(expr)));
}

/** Remplace les variables du scope (récursivement) et développe diff(f, x). */
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
          if (f.args.length !== 2 || f.args[1].type !== 'SymbolNode') throw new Error('diff(f, x) attend une expression et une variable');
          const v = (f.args[1] as unknown as { name: string }).name;
          return math.derivative(rec(f.args[0]), v);
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
    // moitié des points positifs (domaines de ln, sqrt), moitié dans [-3, 3]
    yield Array.from({ length: nv }, () => (k % 2 ? 0.2 + rnd() * 3.3 : -3 + rnd() * 6));
  }
}

function reel(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v && typeof v === 'object' && 're' in v && 'im' in v) {
    const c = v as { re: number; im: number };
    return Math.abs(c.im) < 1e-12 && Number.isFinite(c.re) ? c.re : null;
  }
  if (v && typeof v === 'object' && 'toNumber' in v) {
    try { return reel((v as { toNumber: () => number }).toNumber()); } catch { return null; }
  }
  return null;
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

/**
 * Deux expressions sont-elles équivalentes ? Vrai si elles donnent la même valeur
 * sur au moins 4 points où les deux sont définies (et aucun point en désaccord).
 */
export function equivalentes(a: MathNode | string, b: MathNode | string, tol = 1e-6): boolean {
  try {
    const na = typeof a === 'string' ? developper(parse(a)) : developper(a);
    const nb = typeof b === 'string' ? developper(parse(b)) : developper(b);
    const vars = [...new Set([...variablesLibres(na), ...variablesLibres(nb)])];
    const ca = na.compile(), cb = nb.compile();
    if (vars.length === 0) {
      const x = reel(ca.evaluate({})), y = reel(cb.evaluate({}));
      return x !== null && y !== null && procheNombre(x, y, tol);
    }
    let accords = 0;
    for (const p of points(24, vars.length)) {
      const scope = Object.fromEntries(vars.map((v, i) => [v, p[i]]));
      let x: number | null, y: number | null;
      try { x = reel(ca.evaluate({ ...scope })); } catch { x = null; }
      try { y = reel(cb.evaluate({ ...scope })); } catch { y = null; }
      if (x === null || y === null) continue;
      if (!procheNombre(x, y, tol)) return false;
      accords++;
    }
    return accords >= 4;
  } catch {
    return false;
  }
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
      if (v.egal_a === undefined) return { ok: false, detail: 'egal_a manquant' };
      const ok = equivalentes(v.expression, v.egal_a);
      return { ok, detail: ok ? `${v.expression} = ${v.egal_a}` : `${v.expression} ≠ ${v.egal_a}` };
    }
    if (type === 'racines') {
      const f = developper(parse(v.expression));
      const vars = variablesLibres(f);
      const x = v.variable ?? vars[0] ?? 'x';
      const mauvaises = (v.valeurs ?? []).filter((r) => {
        const val = evaluerNombre(String(r));
        if (val === null) return true;
        const y = evaluerNombre(f, { [x]: val });
        return y === null || Math.abs(y) > 1e-9;
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
    return { ok: false, detail: `type inconnu ${type}` };
  } catch (e) {
    return { ok: false, detail: 'erreur : ' + (e as Error).message };
  }
}

export { math };
