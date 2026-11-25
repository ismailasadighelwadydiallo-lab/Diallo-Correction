// Moteur de notation sans IA (section 7 du cahier des charges).
import type { MathNode } from 'mathjs';
import type { Pack, Question, QuestionEtapes, QuestionNumerique, QuestionQcm, QuestionTexteCourt, ReglesPack } from '../pack/types.ts';
import { arrondiPas, etapeId, exerciceDe } from '../pack/validate.ts';
import { developper, equivalentes, evaluerNombre, parse, variablesLibres } from '../math/engine.ts';
import { texteCorrespond } from './texte.ts';
import type {
  Confiance, Copie, Modification, Reponse, ReponseEtapes, ReponseNumerique, ReponsePoints, ReponseQcm, ReponseTexte,
  Resultat, ResultatEtape, ResultatQuestion, Source,
} from './types.ts';

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
const pt = (n: number) => `${fmt(n)} pt`;

export const SEUIL_CONFIANCE = 0.7;

// ---------------------------------------------------------------- QCM (règle 5)
function noterQcm(q: QuestionQcm, r: ReponseQcm | undefined, regles: ReglesPack): Omit<ResultatQuestion, 'id' | 'exercice' | 'max' | 'confiance'> & { notation: number } {
  const choix = [...new Set(r?.choix ?? [])];
  const multi = q.bonnes.length > 1;
  const negatif = !!regles.qcm_negatif;
  const etape = (points: number, explication?: string): ResultatEtape => ({ id: 'reponse', critere: 'Réponse', points, max: q.points, explication });
  if (choix.length === 0) return { points: 0, etapes: [etape(0, 'Pas de réponse.')], explications: ['Pas de réponse.'], notation: 1 };
  if (!multi) {
    if (choix.length > 1) {
      const e = `Plusieurs cases cochées (${choix.join(', ')}) alors qu'une seule réponse est attendue.`;
      return { points: 0, etapes: [etape(0, e)], explications: [e], notation: 1 };
    }
    if (choix[0] === q.bonnes[0]) return { points: q.points, etapes: [etape(q.points)], explications: [], notation: 1 };
    const p = negatif ? -(q.penalite ?? 0) : 0;
    const e = `Réponse ${choix[0]}, la bonne réponse est ${q.bonnes[0]}.` + (p < 0 ? ` Pénalité ${pt(p)} (prévue par le sujet).` : '');
    return { points: p, etapes: [etape(p, e)], explications: [e], notation: 1 };
  }
  const bonnes = choix.filter((c) => q.bonnes.includes(c));
  const fausses = choix.filter((c) => !q.bonnes.includes(c));
  const manquantes = q.bonnes.filter((c) => !choix.includes(c));
  const detail = [
    manquantes.length ? `manque ${manquantes.join(', ')}` : '',
    fausses.length ? `coché à tort ${fausses.join(', ')}` : '',
  ].filter(Boolean).join(' ; ');
  if (!manquantes.length && !fausses.length) return { points: q.points, etapes: [etape(q.points)], explications: [], notation: 1 };
  const regle = q.regle_multi ?? regles.qcm_multi ?? 'tout_ou_rien';
  let p: number;
  let e: string;
  if (regle === 'tout_ou_rien') {
    p = negatif ? -(q.penalite ?? 0) : 0;
    e = `Toutes les bonnes réponses (${q.bonnes.join(', ')}) sont exigées : ${detail}.`;
  } else {
    const brut = (q.points * (bonnes.length - fausses.length)) / q.bonnes.length;
    p = brut >= 0 ? arrondiPas(brut) : negatif ? -arrondiPas(-brut) : 0;
    e = `Points partiels : ${bonnes.length}/${q.bonnes.length} bonnes réponses${fausses.length ? `, ${fausses.length} fausse(s) retirée(s)` : ''} (${detail}).`;
  }
  return { points: p, etapes: [etape(p, e)], explications: [e], notation: 1 };
}

// ---------------------------------------------------------------- Numérique
const RE_NOMBRE = /^\s*([-+]?\s*(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:\s*[eE]\s*[-+]?\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?)\s*(.*?)\s*$/;
const normUnite = (u: string) => u.replace(/\s+/g, '').replace(/²/g, '2').replace(/³/g, '3').replace(/·/g, '.');

export function lireNombreEtUnite(s: string): { valeur: number | null; unite: string } {
  const m = RE_NOMBRE.exec(s);
  if (m) {
    const v = evaluerNombre(m[1].replace(/\s+/g, ''));
    if (v !== null) return { valeur: v, unite: normUnite(m[2]) };
  }
  return { valeur: evaluerNombre(s), unite: '' };
}

function noterNumerique(q: QuestionNumerique & { valeur: number }, r: ReponseNumerique | undefined) {
  const etape = (points: number, explication?: string): ResultatEtape => ({ id: 'reponse', critere: 'Valeur', points, max: q.points, explication });
  if (!r || !r.valeur.trim()) return { points: 0, etapes: [etape(0, 'Pas de réponse.')], explications: ['Pas de réponse.'], notation: 1 };
  const { valeur, unite } = lireNombreEtUnite(r.valeur);
  if (valeur === null) {
    const e = `Valeur illisible : « ${r.valeur} ».`;
    return { points: 0, etapes: [etape(0, e)], explications: [e], notation: 0.6 };
  }
  let facteur = 1;
  let uniteManquante = false;
  if (q.unite) {
    const ref = normUnite(q.unite);
    const autres = Object.fromEntries(Object.entries(q.unites ?? {}).map(([k, f]) => [normUnite(k), f]));
    if (!unite) uniteManquante = true;
    else if (unite === ref) facteur = 1;
    else if (unite in autres) facteur = autres[unite];
    else {
      const e = `Unité « ${unite} » incorrecte (attendue : ${q.unite}).`;
      return { points: 0, etapes: [etape(0, e)], explications: [e], notation: 0.9 };
    }
  }
  const v = valeur * facteur;
  const tol = Math.max(q.tolerance?.absolue ?? 0, (q.tolerance?.relative ?? 0) * Math.abs(q.valeur), 1e-9 * Math.max(1, Math.abs(q.valeur)));
  const ecart = Math.abs(v - q.valeur);
  const attendu = `${fmt(q.valeur)}${q.unite ? ' ' + q.unite : ''}`;
  if (ecart > tol) {
    const e = `Valeur ${fmt(v)}${q.unite ? ' ' + q.unite : ''}, attendue ${attendu}${tol > 1e-6 ? ` (± ${fmt(tol)})` : ''}.`;
    // près de la limite de tolérance : notation moins sûre
    return { points: 0, etapes: [etape(0, e)], explications: [e], notation: ecart < tol * 1.2 ? 0.6 : 1 };
  }
  const notation = tol > 1e-6 && ecart > tol * 0.8 ? 0.6 : 1;
  if (uniteManquante) {
    const pen = q.penalite_unite ?? 0.25;
    const p = Math.max(0, q.points - pen);
    const e = `Unité manquante (${q.unite}) : −${pt(Math.min(pen, q.points))}.`;
    return { points: p, etapes: [etape(p, e)], explications: [e], notation };
  }
  return { points: q.points, etapes: [etape(q.points)], explications: [], notation };
}

// ---------------------------------------------------------------- Texte court
function noterTexte(q: QuestionTexteCourt & { reponses: string[] }, r: ReponseTexte | undefined) {
  const etape = (points: number, explication?: string): ResultatEtape => ({ id: 'reponse', critere: 'Réponse', points, max: q.points, explication });
  if (!r || !r.texte.trim()) return { points: 0, etapes: [etape(0, 'Pas de réponse.')], explications: ['Pas de réponse.'], notation: 1 };
  if (texteCorrespond(r.texte, q.reponses)) return { points: q.points, etapes: [etape(q.points)], explications: [], notation: 1 };
  const e = `« ${r.texte.trim()} » ne correspond pas à la réponse attendue (« ${q.reponses[0]} »).`;
  // un synonyme non prévu reste possible : notation un peu moins sûre
  return { points: 0, etapes: [etape(0, e)], explications: [e], notation: 0.85 };
}

// ---------------------------------------------------------------- Étapes (règles 1, 3, 4, 6, 7)
const confianceSource = (s: Source | undefined) => (s === 'ia' ? 0.6 : s === undefined ? 0.9 : 1);

type AvecEtapes = Question & { etapes: NonNullable<Question['etapes']>; montrer_que?: boolean };

function cibleFinale(q: AvecEtapes): MathNode | null {
  const v = [q.verification ?? []].flat().find((x) => x.egal_a && (x.type ?? 'egal') === 'egal');
  if (v) return developper(parse(v.egal_a!));
  const scope: Record<string, MathNode> = {};
  let dernier: MathNode | null = null;
  for (const e of q.etapes) {
    if (!e.attendu) continue;
    dernier = developper(parse(e.attendu), scope);
    if (e.variable) scope[e.variable] = dernier;
  }
  return dernier;
}

function noterEtapes(q: AvecEtapes, r: ReponseEtapes | undefined) {
  const montrerQue = q.montrer_que ?? q.type === 'demonstration';
  const explications: string[] = [];
  const vide = !r || (Object.keys(r.etapes).length === 0 && !r.methode_alternative);

  // Règle 7 : méthode différente, acceptée si le moteur vérifie le résultat.
  if (r?.methode_alternative) {
    const cible = cibleFinale(q);
    const ma = r.methode_alternative;
    let juste = false;
    try { juste = !!cible && equivalentes(parse(ma.valeur), cible); } catch { juste = false; }
    if (juste && (ma.justifiee || !montrerQue)) {
      const e = 'Méthode différente du corrigé : résultat vérifié par le moteur de calcul, points accordés.';
      return {
        points: q.points,
        etapes: q.etapes.map((x, i) => ({ id: etapeId(q, i), critere: x.critere, points: x.points, max: x.points })),
        explications: [e],
        notation: Math.min(0.75, confianceSource(ma.source)),
      };
    }
    if (juste && montrerQue) {
      const e: string = '« Montrer que » : résultat recopié sans démonstration, 0 point.';
      return { points: 0, etapes: q.etapes.map((x, i) => ({ id: etapeId(q, i), critere: x.critere, points: 0, max: x.points, explication: e })), explications: [e], notation: 0.9 };
    }
  }

  const attenduScope: Record<string, MathNode> = {};
  const eleveScope: Record<string, MathNode> = {};
  const faussesVars = new Set<string>();
  const etapes: ResultatEtape[] = [];
  let notation = 1;

  q.etapes.forEach((x, i) => {
    const id = etapeId(q, i);
    const re = r?.etapes[id];
    const res: ResultatEtape = { id, critere: x.critere, points: 0, max: x.points };
    let attendu: MathNode | null = null;
    if (x.attendu) {
      attendu = developper(parse(x.attendu), attenduScope);
      if (x.variable) attenduScope[x.variable] = attendu;
    }
    if (x.reponses && re?.valeur !== undefined && re.valeur.trim() !== '') {
      // étape à réponse courte (synonymes acceptés)
      if (texteCorrespond(re.valeur, x.reponses)) res.points = x.points;
      else {
        res.explication = `${x.critere} : « ${re.valeur.trim()} » au lieu de « ${x.reponses[0]} ».`;
        notation = Math.min(notation, 0.85);
      }
    } else if (attendu && re?.valeur !== undefined && re.valeur.trim() !== '') {
      let eleve: MathNode | null = null;
      try { eleve = parse(re.valeur); } catch { eleve = null; }
      if (!eleve) {
        res.explication = `Écriture illisible : « ${re.valeur} ».`;
        notation = Math.min(notation, 0.6);
        if (x.variable) faussesVars.add(x.variable);
      } else {
        if (x.variable) eleveScope[x.variable] = eleve;
        const tol = x.tolerance ?? 1e-6;
        if (equivalentes(eleve, attendu, tol)) {
          res.points = x.points;
        } else {
          if (x.variable) faussesVars.add(x.variable);
          const deps = variablesLibres(parse(x.attendu!)).filter((v) => faussesVars.has(v) && v !== x.variable);
          let coherent = false;
          if (deps.length) {
            try {
              const c = developper(parse(x.attendu!), { ...attenduScope, ...eleveScope });
              coherent = equivalentes(eleve, c, tol);
            } catch { coherent = false; }
          }
          if (coherent) {
            // Règle 4 : erreur entraînée, pénalisée une seule fois.
            res.points = x.points;
            res.entrainee = true;
            res.explication = `Erreur entraînée : résultat faux mais cohérent avec la valeur trouvée pour ${deps.join(', ')}. Points conservés.`;
            notation = Math.min(notation, 0.9);
          } else {
            res.explication = `Obtenu « ${re.valeur} », attendu « ${x.attendu} »${deps.length ? '' : ''}.`;
          }
        }
      }
    } else if (re?.statut) {
      res.points = re.statut === 'juste' ? x.points : 0;
      if (re.statut === 'faux') res.explication = `${x.critere} : non satisfait.`;
      if (re.statut === 'absent') res.explication = `${x.critere} : absent.`;
      notation = Math.min(notation, confianceSource(re.source));
    } else {
      res.explication = `${x.critere} : absent.`;
      if (!vide && !x.attendu) notation = Math.min(notation, 0.9);
    }
    etapes.push(res);
  });

  // Règle 3 : « Montrer que… » — résultat sans démonstration = 0.
  if (montrerQue) {
    const demo = etapes.filter((e, i) => (q.etapes[i].nature ?? 'calcul') !== 'resultat');
    const resultat = etapes.filter((e, i) => q.etapes[i].nature === 'resultat');
    if (demo.length && resultat.length && demo.every((e) => e.points === 0) && resultat.some((e) => e.points > 0)) {
      const e = '« Montrer que » : résultat recopié sans démonstration, 0 point.';
      resultat.forEach((x) => { x.points = 0; x.explication = e; });
      explications.push(e);
    }
  }

  for (const e of etapes) if (e.explication && e.points < e.max) explications.push(e.explication);
  for (const e of etapes) if (e.entrainee && e.explication) explications.push(e.explication);
  const points = etapes.reduce((a, e) => a + e.points, 0);
  if (vide) return { points: 0, etapes, explications: ['Pas de réponse.'], notation: 1 };
  return { points, etapes, explications, notation };
}

// ---------------------------------------------------------------- Points notés sur la feuille
function noterPoints(q: Question, r: ReponsePoints) {
  const p = Math.max(0, Math.min(q.points, arrondiPas(r.points)));
  const e = p < q.points ? `Noté ${pt(p)} sur ${pt(q.points)} par l'enseignant (cases de points).` : undefined;
  return { points: p, etapes: [{ id: 'points', critere: 'Points notés sur la feuille', points: p, max: q.points, explication: e }], explications: e ? [e] : [], notation: 1 };
}

// ---------------------------------------------------------------- API
export function noterQuestion(q: Question, r: Reponse | undefined, regles: ReglesPack = {}): ResultatQuestion {
  let out: { points: number; etapes: ResultatEtape[]; explications: string[]; notation: number };
  if (r && 'points' in r) out = noterPoints(q, r);
  else if (q.type === 'qcm') out = noterQcm(q, r as ReponseQcm | undefined, regles);
  else if (q.type === 'numerique' && q.valeur !== undefined) out = noterNumerique(q as QuestionNumerique & { valeur: number }, r as ReponseNumerique | undefined);
  else if (q.type === 'texte_court' && q.reponses) out = noterTexte(q as QuestionTexteCourt & { reponses: string[] }, r as ReponseTexte | undefined);
  else if (q.etapes?.length) out = noterEtapes(q as AvecEtapes, r as ReponseEtapes | undefined);
  else throw new Error(`${q.id} : ni réponse attendue ni étapes`);
  const lecture = r?.lecture?.confiance ?? 1;
  return {
    id: q.id,
    exercice: exerciceDe(q),
    points: out.points,
    max: q.points,
    etapes: out.etapes,
    explications: out.explications,
    confiance: { lecture, notation: out.notation },
  };
}

const arrondi2 = (x: number) => Math.round(x * 100) / 100;

function totaliser(pack: Pack, questions: ResultatQuestion[], copie: Copie | null, modifications: Modification[]): Resultat {
  const total = pack.total;
  const note = Math.max(0, questions.reduce((a, q) => a + q.points, 0));
  const seuil = pack.regles?.seuil_confiance ?? SEUIL_CONFIANCE;
  const confiance: Confiance = {
    lecture: Math.min(1, ...questions.map((q) => (q.modifiee ? 1 : q.confiance.lecture))),
    notation: Math.min(1, ...questions.map((q) => (q.modifiee ? 1 : q.confiance.notation))),
  };
  const raisons: string[] = [];
  for (const q of questions) {
    if (q.modifiee) continue;
    const st = copie?.reponses[q.id]?.lecture?.statut;
    if (st === 'multiple') raisons.push(`${q.id} : plusieurs cases cochées`);
    else if (st === 'incertain') raisons.push(`${q.id} : case difficile à lire`);
    else if (q.confiance.lecture < seuil) raisons.push(`${q.id} : lecture incertaine`);
    if (q.confiance.notation < seuil) raisons.push(`${q.id} : notation automatique incertaine`);
  }
  return {
    note: arrondi2(note),
    total,
    sur20: arrondi2((note / total) * 20),
    questions,
    confiance,
    douteuse: raisons.length > 0,
    raisons_doute: raisons,
    modifications,
  };
}

/** Note une copie complète. Les modifications de l'enseignant sont appliquées et conservées. */
export function noterCopie(pack: Pack, copie: Copie, modifications: Modification[] = []): Resultat {
  const regles = pack.regles ?? {};
  const qs = pack.questions.map((q) => noterQuestion(q, copie.reponses[q.id], regles));
  return totaliser(pack, appliquer(qs, modifications), copie, modifications);
}

function appliquer(qs: ResultatQuestion[], mods: Modification[]): ResultatQuestion[] {
  const der = new Map<string, Modification>();
  for (const m of mods) der.set(m.question, m);
  return qs.map((q) => {
    const m = der.get(q.id);
    if (!m) return q;
    return { ...q, points: m.nouveau, points_auto: q.points, modifiee: true, explications: [...q.explications, `Note modifiée par l'enseignant : ${pt(q.points)} → ${pt(m.nouveau)}${m.motif ? ` (${m.motif})` : ''}.`] };
  });
}

/** Modifie la note d'une question ; la modification est ajoutée au journal de la copie. */
export function modifierNote(pack: Pack, copie: Copie, resultat: Resultat, question: string, nouveau: number, motif?: string, date = new Date().toISOString()): Resultat {
  const q = pack.questions.find((x) => x.id === question);
  if (!q) throw new Error(`Question inconnue : ${question}`);
  const min = pack.regles?.qcm_negatif && q.type === 'qcm' ? -(q.penalite ?? 0) : 0;
  if (nouveau < min || nouveau > q.points) throw new Error(`La note doit être entre ${min} et ${q.points}.`);
  if (Math.abs(nouveau * 4 - Math.round(nouveau * 4)) > 1e-9) throw new Error('La note doit être un multiple de 0,25.');
  const ancien = resultat.questions.find((x) => x.id === question)?.points ?? 0;
  const mods = [...resultat.modifications, { question, ancien, nouveau, motif, date }];
  return noterCopie(pack, copie, mods);
}
