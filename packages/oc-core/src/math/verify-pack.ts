// Vérifie toutes les réponses mathématiques d'un pack (vérifications et étapes avec `attendu`).
import type { MathNode } from 'mathjs';
import type { Pack } from '../pack/types.ts';
import { etapeId } from '../pack/validate.ts';
import { developper, parse, verifier } from './engine.ts';

export interface RapportVerification {
  question: string;
  quoi: string;
  ok: boolean;
  detail: string;
}

export function verifierPackMath(pack: Pack): RapportVerification[] {
  const out: RapportVerification[] = [];
  for (const q of pack.questions) {
    if (q.verification) {
      const r = verifier(q.verification);
      out.push({ question: q.id, quoi: 'vérification', ...r });
    }
    const scope: Record<string, MathNode> = {};
    q.etapes?.forEach((e, i) => {
      if (!e.attendu) return;
      try {
        const n = developper(parse(e.attendu), scope);
        if (e.variable) scope[e.variable] = n;
        out.push({ question: q.id, quoi: `étape ${etapeId(q, i)}`, ok: true, detail: `attendu lisible : ${n.toString()}` });
      } catch (err) {
        out.push({ question: q.id, quoi: `étape ${etapeId(q, i)}`, ok: false, detail: 'attendu illisible : ' + (err as Error).message });
      }
    });
  }
  return out;
}
