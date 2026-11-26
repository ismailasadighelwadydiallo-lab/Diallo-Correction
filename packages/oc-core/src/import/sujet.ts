// Import d'un sujet à partir de son texte (lu dans un PDF ou par OCR sur une photo).
//
// Le découpage en exercices et questions est une HEURISTIQUE : il repère les titres
// « Exercice 1 (4 pts) », les numéros « 1) », « 2. », « a) », et les points « (1 pt) ».
// Il ne comprend pas le sujet. Le résultat est toujours montré à l'enseignant, qui corrige
// avant d'enregistrer. Rien n'est inventé : un point non trouvé dans le texte reste « inconnu ».
import type { Pack, QuestionEtapes } from '../pack/types.ts';
import { PAS } from '../pack/validate.ts';

export interface QuestionDecoupee {
  id: string;
  enonce: string;
  /** Points lus dans le texte, ou null si le sujet ne les donne pas. */
  points: number | null;
  /** Phrase d'introduction commune (énoncé de l'exercice, « Soit f… »). */
  contexte?: string;
}

export interface ExerciceDecoupe {
  titre: string;
  points: number | null;
  /** Texte de l'exercice avant sa première question. */
  introduction: string;
  questions: QuestionDecoupee[];
}

export interface SujetDecoupe {
  titre: string;
  entete: string[];
  exercices: ExerciceDecoupe[];
  avertissements: string[];
}

const CHIFFRES_ARABES: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };

/** Nettoie le texte brut : chiffres arabes-indiens → 0-9, espaces, lignes vides. */
export function nettoyerTexte(t: string): string[] {
  return t
    .replace(/[٠-٩۰-۹]/g, (c) => CHIFFRES_ARABES[c] ?? c)
    .replace(/\r/g, '')
    .replace(/[   ]/g, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

const RE_POINTS = /[([]\s*(\d+(?:[.,]\d+)?)\s*(?:pts?|points?|pt\.|ن|نقطة|نقاط|نقط)\s*[)\]]|(\d+(?:[.,]\d+)?)\s*(?:pts|points|نقاط|نقط)\b/i;
const RE_EXERCICE = /^(?:exercice|exo|probl[eè]me|partie|situation|التمرين|تمرين|المسألة|مسألة|الجزء)\s*(?:n[°o]\s*)?([0-9]+|[ivx]+|[a-z]|الأول|الثاني|الثالث|الرابع|الخامس)?(?![\p{L}\p{N}])/iu;
const RE_QUESTION = /^(?:question\s*)?(\d{1,2})\s*(?:[).°\-–/]|\s*:)\s*(.*)$/i;
const RE_SOUS = /^([a-h])\s*[)\-–.]\s*(.+)$/i;

/**
 * Corrections sûres des formules lues par OCR : le « ^ » est souvent lu comme un guillemet
 * (x"2, e“(2-x)). On ne remplace que ce motif précis ; le reste doit être relu par l'enseignant.
 */
export function corrigerFormulesOcr(t: string): string {
  return t.replace(/((?<![A-Za-zÀ-ÿ])[a-zA-Z]|[0-9)])\s?["“”″'’`]\s?(?=[0-9(\-])/g, '$1^');
}

/** Points écrits dans une ligne (« (2 pts) », « 1,5 pt »), ou null. */
export function pointsDans(ligne: string): number | null {
  const m = RE_POINTS.exec(ligne);
  if (!m) return null;
  const v = Number((m[1] ?? m[2]).replace(',', '.'));
  return Number.isFinite(v) && v > 0 && v <= 40 ? v : null;
}
const sansPoints = (l: string) => l.replace(RE_POINTS, '').replace(/\s{2,}/g, ' ').trim();

/** Découpe le texte d'un sujet en exercices et questions. */
export function decouperSujet(texte: string): SujetDecoupe {
  const lignes = nettoyerTexte(texte);
  const entete: string[] = [];
  const exercices: ExerciceDecoupe[] = [];
  const avertissements: string[] = [];
  let ex: ExerciceDecoupe | null = null;
  let q: QuestionDecoupee | null = null;
  let parent: { num: string; texte: string; points: number | null } | null = null; // question avec a), b)…
  let preambule: string[] = [];

  const nouvelExercice = (titre: string, points: number | null) => {
    ex = { titre, points, introduction: '', questions: [] };
    exercices.push(ex);
    q = null; parent = null; preambule = [];
  };
  const contexteCourant = () => [preambule.join(' '), parent?.texte].filter(Boolean).join(' ').trim() || undefined;

  for (const l of lignes) {
    const mEx = RE_EXERCICE.exec(l);
    if (mEx && l.length < 90) { nouvelExercice(sansPoints(l).replace(/[:.\-–]+$/, '').trim(), pointsDans(l)); continue; }
    const mQ = RE_QUESTION.exec(l);
    const mS = RE_SOUS.exec(l);
    if (mQ && (ex || exercices.length === 0)) {
      if (!ex) nouvelExercice('Exercice 1', null);
      const e = ex!;
      const texteQ = sansPoints(mQ[2]);
      parent = { num: mQ[1], texte: texteQ, points: pointsDans(l) };
      q = { id: mQ[1], enonce: texteQ, points: pointsDans(l), contexte: preambule.join(' ') || undefined };
      e.questions.push(q);
      continue;
    }
    if (mS && ex && parent) {
      const e = ex as ExerciceDecoupe;
      const p = parent as { num: string; texte: string; points: number | null };
      // La question « 1) » devient l'introduction de ses sous-questions « 1.a », « 1.b ».
      const idx = e.questions.findIndex((x) => x.id === p.num);
      if (idx >= 0) e.questions.splice(idx, 1);
      q = { id: `${p.num}.${mS[1].toLowerCase()}`, enonce: sansPoints(mS[2]), points: pointsDans(l), contexte: contexteCourant() };
      e.questions.push(q);
      continue;
    }
    if (q) {
      const qq = q as QuestionDecoupee;
      qq.enonce = `${qq.enonce} ${sansPoints(l)}`.trim();
      if (qq.points === null) qq.points = pointsDans(l);
      if (parent && (parent as { num: string }).num === qq.id) (parent as { texte: string }).texte = qq.enonce;
    } else if (ex) { preambule.push(l); (ex as ExerciceDecoupe).introduction = preambule.join(' '); }
    else entete.push(l);
  }

  // Une question « 1) » sans texte propre et sans sous-question n'apporte rien : on la retire.
  for (const e of exercices) e.questions = e.questions.filter((x) => x.enonce.length > 0);
  // Exercice sans question numérotée : tout l'exercice devient une seule question.
  for (const e of exercices as ExerciceDecoupe[]) {
    if (!e.questions.length) {
      avertissements.push(`« ${e.titre} » : aucune question numérotée trouvée, l'exercice est gardé en une seule question.`);
    }
  }
  if (!exercices.length) avertissements.push('Aucun exercice ni question numérotée reconnu : vérifiez le texte lu, ou découpez à la main.');
  const sansPts = exercices.flatMap((e) => e.questions).filter((x) => x.points === null).length;
  if (sansPts) avertissements.push(`${sansPts} question(s) sans points écrits dans le sujet : à compléter.`);
  const titre = entete.find((l) => /bac|bepc|examen|devoir|composition|session|math|physi|sciences|fran|arab|الباكالوريا|شهادة|امتحان/i.test(l)) ?? entete[0] ?? 'Sujet importé';
  return { titre: titre.slice(0, 120), entete, exercices, avertissements };
}

export interface OptionsPack {
  id: string;
  titre?: string;
  langue?: Pack['langue'];
  matiere?: string;
  serie?: string;
  examen?: string;
  annee?: number;
  /** Origine du texte, gardée dans le pack (lecture, confiance OCR moyenne). */
  lecture?: NonNullable<Pack['meta']>['lecture'];
  cree_le?: string;
}

const auPas = (x: number) => Math.max(PAS, Math.round(x / PAS) * PAS);

/**
 * Pack à partir d'un sujet découpé (après relecture par l'enseignant).
 * Points : ceux du sujet ; sinon, partage égal des points de l'exercice (signalé) ; sinon 1 pt (signalé).
 * Le barème n'est jamais marqué « officiel ».
 */
export function sujetVersPack(s: SujetDecoupe, o: OptionsPack): Pack {
  const points_proposes: string[] = [];
  const questions: QuestionEtapes[] = [];
  s.exercices.forEach((e, i) => {
    const qs = e.questions.length ? e.questions : [{ id: '1', enonce: e.introduction || e.titre, points: e.points }];
    const connus = qs.reduce((t, x) => t + (x.points ?? 0), 0);
    const inconnus = qs.filter((x) => x.points === null).length;
    for (const x of qs) {
      let pts = x.points;
      const id = `Ex${i + 1}-${x.id}`;
      if (pts === null) {
        pts = e.points !== null && e.points > connus ? auPas((e.points - connus) / inconnus) : 1;
        points_proposes.push(`${id} : points non écrits dans le sujet, ${pts} pt proposé`);
      } else pts = auPas(pts);
      questions.push({
        id, exercice: e.titre, enonce: x.enonce, consigne: x.contexte, points: pts, type: 'question_ouverte',
        etapes: [{ critere: 'Réponse juste et justifiée', points: pts }],
      });
    }
  });
  const total = questions.reduce((t, q) => t + q.points, 0);
  return {
    format: 'oc-pack/1', id: o.id, titre: o.titre ?? s.titre, langue: o.langue ?? 'fr', total,
    ...(o.examen ? { examen: o.examen } : {}), ...(o.serie ? { serie: o.serie } : {}), ...(o.matiere ? { matiere: o.matiere } : {}), ...(o.annee ? { annee: o.annee } : {}),
    questions,
    meta: {
      source: o.lecture ? `sujet importé (${o.lecture.source})` : 'sujet importé',
      cree_le: o.cree_le,
      avertissement: 'Sujet importé automatiquement : découpage et points à vérifier ; barème non officiel.',
      ...(points_proposes.length ? { points_proposes } : {}),
      ...(o.lecture ? { lecture: o.lecture } : {}),
    },
  };
}
