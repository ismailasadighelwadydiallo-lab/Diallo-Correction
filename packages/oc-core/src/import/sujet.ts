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

// Points : « (2 pts) », « (1.5pt) », « 0,75 pt » en fin de ligne (colonne du barème), en arabe « (2 ن) ».
// L'OCR lit souvent « 05pt » (0,5), « o5pt », « 075pt », « 125 pt » (1,25), « S » pour 5 : corrigé
// seulement si le résultat est un multiple de 0,25 plausible.
const NB = String.raw`(?:[0-9oOSsI©]+(?:\s?[.,]\s?[0-9oOSs]+)?|[.,][0-9oOSs]+)`;
const RE_POINTS = new RegExp(String.raw`[([]\s*(${NB})\s*(?:pts?|points?|pt\.|ن|نقطة|نقاط|نقط)\s*[)\]]|(?:^|\s|\|)(${NB})\s*(?:p[tr]s?|points?|نقاط|نقط)\.?\s*\|?\s*$`, 'u');
const RE_EXERCICE = /^(?:exer\p{L}{2}[ie]?ce|exo|probl[eè]me|partie|situation|التمرين|تمرين|المسألة|مسألة|الجزء)\s*(?:n[°o]\s*)?([0-9]+|[ivxlI]+|[a-z]|الأول|الثاني|الثالث|الرابع|الخامس)?(?![\p{L}\p{N}])/iu;
const RE_QUESTION = /^(?:question\s*)?(\d{1,2})\s*(?:[).°\-–/,]|\s*:)\s*(.*)$/i;
// Numéro sans ponctuation (« 5 On considère ») : accepté seulement s'il suit le numéro précédent.
const RE_QUESTION_NU = /^(\d{1,2})\s+(\p{Lu}.*)$/u;
// Titre de partie numérotée avec ses points : « 1- QCM (2pts) », « 2-QROC(5pts) ».
const RE_PARTIE = /^(\d{1,2})\s*[-–.)]\s*(\p{Lu}{3,}[\p{L} ]{0,20})\s*[([]/u;
// Grande partie sans points : « I-Maîtrise des connaissances », « II- Compétences… ».
const RE_SECTION = /^[IVX]{1,4}\s*[-–.]\s*\p{Lu}/u;
const RE_QUESTION_EX = /^ex\s*\d+\s*[-–.]\s*(\d{1,2})\s*([a-h])?(?![\p{L}\p{N}])\s*(.*)$/iu; // « Ex1-1a (0,5 pt) — … »
// Sous-question en minuscule (« D. Déterminer » est une phrase, pas une sous-question).
const RE_SOUS = /^([a-h])\s*[)\-–.]\s*(.+)$/;
const RE_FIN_SUJET = /^(?:\d+\s*[.)-]\s*)?(?:corrig[ée]s?|correction|bar[èe]me|éléments de (?:correction|réponse))(?![\p{L}])/iu;
const debutLigneOcr = (l: string) => l.replace(/^©\s*\)/, 'c)');
const RE_DECHET = /^[|'"`.,;:«»\-–—_~*•·¦!#\s]+/;

/**
 * Corrections sûres des formules lues par OCR : le « ^ » est souvent lu comme un guillemet
 * (x"2, e“(2-x)). On ne remplace que ce motif précis ; le reste doit être relu par l'enseignant.
 */
export function corrigerFormulesOcr(t: string): string {
  return t.replace(/((?<![A-Za-zÀ-ÿ])[a-zA-Z]|[0-9)])\s?["“”″'’`]\s?(?=[0-9(\-])/g, '$1^');
}

function valeurPoints(brut: string): number | null {
  let t = brut.replace(/\s/g, '').replace(/[oO©]/g, '0').replace(/[Ss]/g, '5').replace(/[lI]/g, '1').replace(',', '.');
  if (t.startsWith('.')) t = `0${t}`;
  if (!t.includes('.')) {
    if (/^0\d+$/.test(t)) t = `0.${t.slice(1)}`; // 05 → 0.5, 075 → 0.75
    else if (/^\d{3}$/.test(t)) t = `${t[0]}.${t.slice(1)}`; // 125 → 1.25
  }
  const v = Number(t);
  return Number.isFinite(v) && v > 0 && v <= 40 && Math.abs(v * 4 - Math.round(v * 4)) < 1e-9 ? v : null;
}

/** Points écrits dans une ligne (« (2 pts) », « 1,5 pt »), ou null. */
export function pointsDans(ligne: string): number | null {
  const m = RE_POINTS.exec(ligne);
  return m ? valeurPoints(m[1] ?? m[2]) : null;
}
const sansPoints = (l: string) => l.replace(RE_POINTS, '').replace(/\s*\|\s*$/, '').replace(/\s{2,}/g, ' ').trim();
const titreExercice = (l: string, m: RegExpExecArray) => {
  let n = m[1] ? (/^[lI]$/.test(m[1]) ? '1' : m[1]) : '';
  if (/^\d{3}$/.test(n) && /point/i.test(l)) n = n[0]; // « Exercice 153 points) » : « ( » lu « 5 »
  return /^exer/i.test(l) ? `Exercice ${n}`.trim() : sansPoints(l).replace(/[:.\-–]+$/, '').trim();
};

/** Découpe le texte d'un sujet en exercices et questions. */
export function decouperSujet(texte: string): SujetDecoupe {
  const lignes = nettoyerTexte(texte).map((l) => debutLigneOcr(l.replace(RE_DECHET, ''))).filter(Boolean);
  const entete: string[] = [];
  const exercices: ExerciceDecoupe[] = [];
  const avertissements: string[] = [];
  const avecTitres = lignes.some((l) => RE_EXERCICE.test(l) && l.length < 90);
  let ex: ExerciceDecoupe | null = null;
  let q: QuestionDecoupee | null = null;
  let parent: { num: string; texte: string } | null = null; // question avec a), b)…
  let preambule: string[] = [];
  let sousDuParent = 0; // sous-questions lues depuis la dernière question numérotée
  let dernierGlobal = 0; // dernier numéro, tous exercices confondus (numérotation continue)

  const nouvelExercice = (titre: string, points: number | null) => {
    ex = { titre, points, introduction: '', questions: [] };
    exercices.push(ex);
    q = null; parent = null; preambule = [];
  };
  const ajouter = (id: string, texteBrut: string, ligne: string, contexte?: string) => {
    q = { id, enonce: sansPoints(texteBrut), points: pointsDans(ligne), contexte };
    (ex as ExerciceDecoupe).questions.push(q);
  };
  const sousQuestion = (lettre: string, texteQ: string, ligne: string) => {
    const e = ex as ExerciceDecoupe;
    let p = parent as { num: string; texte: string };
    // L'OCR lit souvent « a) » comme « 2) » ou « 4) » : si « b) » arrive sans « a) », la dernière
    // question numérotée était en fait le « a) » de la question précédente.
    const l1 = lettre.toLowerCase();
    if (l1 === 'b' && sousDuParent === 0) {
      const n = e.questions.length;
      const der = e.questions[n - 1], avant = e.questions[n - 2];
      if (der && avant && der.id === p.num && !der.id.includes('.') && !avant.id.includes('.')) {
        e.questions.splice(n - 2, 2);
        p = { num: avant.id, texte: avant.enonce };
        parent = p;
        e.questions.push({ ...der, id: `${avant.id}.a`, contexte: [preambule.join(' '), avant.enonce].filter(Boolean).join(' ').trim() || undefined });
        sousDuParent = 1;
      }
    }
    sousDuParent++;
    // La question « 1) » devient l'introduction de ses sous-questions « 1.a », « 1.b ».
    const idx = e.questions.findIndex((x) => x.id === p.num);
    if (idx >= 0) e.questions.splice(idx, 1);
    const contexte = [preambule.join(' '), p.texte].filter(Boolean).join(' ').trim() || undefined;
    ajouter(`${p.num}.${lettre.toLowerCase()}`, texteQ, ligne, contexte);
  };

  // Numéro plausible : suit le précédent (au plus +2) ; au début d'un exercice : 1, 2, ou la suite
  // d'une numérotation continue. Écarte les nombres lus dans une matrice ou un tableau (« 13-10 »).
  const numeroPlausible = (n: number) => {
    const qs = (ex as ExerciceDecoupe | null)?.questions ?? [];
    if (!qs.length && !parent) return n >= 1 && (n <= 2 || n === dernierGlobal + 1);
    return n >= 1 && n <= dernierNumero() + 2;
  };
  const dernierNumero = () => {
    const qs = (ex as ExerciceDecoupe | null)?.questions ?? [];
    const n = Number((parent as { num: string } | null)?.num ?? qs[qs.length - 1]?.id.split('.')[0]);
    return Number.isFinite(n) ? n : 0;
  };
  for (const l of lignes) {
    if (exercices.length && RE_FIN_SUJET.test(l)) break; // la suite est un corrigé, pas le sujet
    if (RE_SECTION.test(l) && l.length < 70) continue;
    const mEx = RE_EXERCICE.exec(l);
    if (mEx && l.length < 90) {
      const p3 = /^\d{3}$/.test(mEx[1] ?? '') && /point/i.test(l) ? valeurPoints(mEx[1].slice(2)) : null;
      nouvelExercice(titreExercice(l, mEx), pointsDans(l) ?? p3);
      continue;
    }
    const mP = RE_PARTIE.exec(l);
    if (mP && pointsDans(l) !== null) { nouvelExercice(`${mP[1]}-${mP[2].trim()}`, pointsDans(l)); continue; }
    const mX = RE_QUESTION_EX.exec(l);
    let mQ = mX ? null : RE_QUESTION.exec(l);
    if (mQ && ex && !numeroPlausible(Number(mQ[1]))) mQ = null;
    if (!mX && !mQ && ex) {
      const mN = RE_QUESTION_NU.exec(l);
      if (mN && [1, 2].includes(Number(mN[1]) - dernierNumero())) mQ = mN;
    }
    if ((mQ || mX) && (ex || !avecTitres)) {
      if (!ex) nouvelExercice('Exercice 1', null);
      const num = (mX ?? mQ)![1];
      let reste = mX ? mX[3].replace(/^\s*(\([^)]*\))?\s*[—–:-]?\s*/, (t) => (pointsDans(t) !== null ? t.replace(/[—–:-]\s*$/, '') : '')) : mQ![2];
      if (mX && mX[2]) { parent = { num, texte: '' }; sousQuestion(mX[2], mX[3].replace(/^\s*\([^)]*\)\s*[—–:-]?\s*/, ''), l); continue; }
      reste = reste.replace(/^[—–:-]\s*/, '');
      dernierGlobal = Math.max(dernierGlobal, Number(num));
      sousDuParent = 0;
      // « 1. a) Calculer… » ; « 2,3) Soit… » (« 2.a) » mal lu) : première sous-question sur la même ligne.
      const inline = RE_SOUS.exec(reste) ?? (/^[^\s\p{L}]\s*\)\s*(.+)$/u.test(reste) ? (['', 'a', reste.replace(/^[^\s\p{L}]\s*\)\s*/u, '')] as unknown as RegExpExecArray) : null);
      parent = { num, texte: inline ? '' : sansPoints(reste) };
      if (inline) { ajouter(num, '', l); sousQuestion(inline[1], inline[2], l); continue; }
      ajouter(num, reste, l, preambule.join(' ') || undefined);
      continue;
    }
    const mS = RE_SOUS.exec(l);
    if (mS && ex && parent) { sousQuestion(mS[1], mS[2], l); continue; }
    if (q) {
      const qq = q as QuestionDecoupee;
      const t = sansPoints(l);
      if (t) qq.enonce = `${qq.enonce} ${t}`.trim();
      if (qq.points === null) qq.points = pointsDans(l);
      if (parent && (parent as { num: string }).num === qq.id) (parent as { texte: string }).texte = qq.enonce;
    } else if (ex) { preambule.push(l); (ex as ExerciceDecoupe).introduction = preambule.join(' '); }
    else entete.push(l);
  }

  // Une question « 1) » sans texte propre et sans sous-question n'apporte rien : on la retire.
  for (const e of exercices) e.questions = e.questions.filter((x) => x.enonce.length > 0);
  for (const e of exercices as ExerciceDecoupe[]) {
    if (!e.questions.length) avertissements.push(`« ${e.titre} » : aucune question numérotée trouvée, l'exercice est gardé en une seule question.`);
    const somme = e.questions.reduce((t, x) => t + (x.points ?? 0), 0);
    if (e.points !== null && e.questions.every((x) => x.points !== null) && Math.abs(somme - e.points) > 1e-9) {
      avertissements.push(`« ${e.titre} » : les points des questions (${somme}) ne font pas le total annoncé (${e.points}) : une question ou des points ont pu être mal lus.`);
    }
  }
  if (!exercices.length) avertissements.push('Aucun exercice ni question numérotée reconnu : vérifiez le texte lu, ou découpez à la main.');
  const sansPts = exercices.flatMap((e) => e.questions).filter((x) => x.points === null).length;
  if (sansPts) avertissements.push(`${sansPts} question(s) sans points lus dans le sujet : à compléter.`);
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
