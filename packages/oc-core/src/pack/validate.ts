import Ajv from 'ajv';
import { packSchema } from './schema.ts';
import type { Pack, Question } from './types.ts';

/** Granularité minimale des points (règle 2 : pas plus fin que 0,25 pt). */
export const PAS = 0.25;
const EPS = 1e-9;

export const estMultipleDuPas = (x: number) => Math.abs(x / PAS - Math.round(x / PAS)) < EPS;
/** Arrondit vers le bas au quart de point. */
export const arrondiPas = (x: number) => Math.floor(x / PAS + EPS) * PAS;

let validateur: ReturnType<Ajv['compile']> | null = null;
function compile() {
  if (!validateur) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    validateur = ajv.compile(packSchema);
  }
  return validateur;
}

export interface ResultatValidation {
  ok: boolean;
  erreurs: string[];
  /** Avertissements non bloquants (ex. questions à faire relire). */
  avertissements: string[];
}

/** Valide un pack : structure (schéma JSON) puis cohérence du barème. */
export function validerPack(data: unknown): ResultatValidation {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const v = compile();
  if (!v(data)) {
    for (const e of v.errors ?? []) {
      if (e.keyword === 'if') continue; // doublon des erreurs "then"
      erreurs.push(`${e.instancePath || '/'} ${e.message}${e.params && 'allowedValues' in e.params ? ' ' + JSON.stringify(e.params.allowedValues) : ''}${e.params && 'additionalProperty' in e.params ? ' : ' + e.params.additionalProperty : ''}`);
    }
    return { ok: false, erreurs, avertissements };
  }
  const p = data as Pack;
  const ids = new Set<string>();
  let somme = 0;
  if (!estMultipleDuPas(p.total)) erreurs.push(`total ${p.total} n'est pas un multiple de 0,25`);
  for (const q of p.questions) {
    if (ids.has(q.id)) erreurs.push(`${q.id} : identifiant en double`);
    ids.add(q.id);
    somme += q.points;
    erreurs.push(...verifierQuestion(q));
    if (q.a_relire) avertissements.push(`${q.id} : à relire — ${q.a_relire}`);
  }
  if (Math.abs(somme - p.total) > EPS) erreurs.push(`la somme des points des questions (${somme}) est différente du total (${p.total})`);
  return { ok: erreurs.length === 0, erreurs, avertissements };
}

function verifierQuestion(q: Question): string[] {
  const e: string[] = [];
  if (!estMultipleDuPas(q.points)) e.push(`${q.id} : ${q.points} pt n'est pas un multiple de 0,25`);
  if (q.type === 'qcm') {
    for (const b of q.bonnes) if (!q.choix.includes(b)) e.push(`${q.id} : bonne réponse "${b}" absente des choix`);
    if (q.penalite !== undefined && !estMultipleDuPas(q.penalite)) e.push(`${q.id} : pénalité non multiple de 0,25`);
  }
  if (q.etapes?.length) {
    const s = q.etapes.reduce((a, x) => a + x.points, 0);
    if (Math.abs(s - q.points) > EPS) e.push(`${q.id} : la somme des étapes (${s}) est différente des points de la question (${q.points})`);
    const vus = new Set<string>();
    q.etapes.forEach((x, i) => {
      const id = x.id ?? `e${i + 1}`;
      if (vus.has(id)) e.push(`${q.id} : étape "${id}" en double`);
      vus.add(id);
      if (!estMultipleDuPas(x.points)) e.push(`${q.id}/${id} : ${x.points} pt n'est pas un multiple de 0,25`);
    });
  }
  return e;
}

/** Lit un pack depuis du texte JSON ; lève une erreur lisible s'il est invalide. */
export function lirePack(texte: string): Pack {
  let data: unknown;
  try {
    data = JSON.parse(texte);
  } catch {
    throw new Error("Le fichier n'est pas un JSON valide.");
  }
  const r = validerPack(data);
  if (!r.ok) throw new Error('Pack invalide :\n- ' + r.erreurs.join('\n- '));
  return data as Pack;
}

export const exerciceDe = (q: Question) => q.exercice ?? q.id.split('-')[0];
export const etapeId = (q: Question, i: number) => q.etapes?.[i]?.id ?? `e${i + 1}`;
