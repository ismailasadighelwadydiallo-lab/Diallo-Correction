// Catalogue des épreuves et moteurs par matière.
//
// Le catalogue n'a AUCUNE liste figée de séries ou de sessions : il est construit à partir des
// packs présents (examen → série → matière → année/session). Ajouter un pack suffit pour
// enrichir le catalogue, sans toucher au moteur.
//
// Les moteurs par matière décrivent ce que l'application sait vraiment faire pour chaque
// discipline. Un nouveau domaine s'ajoute ici avec : pack + règles de notation + règles de
// vérification + tests. Les capacités marquées `false` ne sont pas encore développées.
import type { Pack, TypeQuestion } from './pack/types.ts';

export interface MoteurMatiere {
  cle: string;
  nom: { fr: string; ar: string };
  /** Mots qui aident à reconnaître la matière dans un titre ou un id (détection, jamais certaine). */
  indices: RegExp;
  /** Types de questions habituels. */
  types: TypeQuestion[];
  capacites: {
    /** Résolution automatique par le solveur local (calcul vérifié). */
    resolutionCalcul: boolean;
    /** Vérification des calculs déclarés dans le pack (math.js). */
    verificationCalcul: boolean;
    /** Contrôle des unités (cohérence dimensionnelle). */
    unites: boolean;
    /** Notation par grille de critères (réponses ouvertes, rédactions). */
    grilleCriteres: boolean;
  };
  /** Ce qui reste à faire, en clair. */
  limites: string;
}

const T = <X extends TypeQuestion[]>(...t: X) => t;

export const MOTEURS: MoteurMatiere[] = [
  { cle: 'mathematiques', nom: { fr: 'Mathématiques', ar: 'الرياضيات' }, indices: /math/i, types: T('qcm', 'numerique', 'calcul', 'demonstration', 'figure', 'graphique', 'tableau', 'raisonnement'),
    capacites: { resolutionCalcul: true, verificationCalcul: true, unites: false, grilleCriteres: true },
    limites: 'Résolution automatique : équations d’une variable, dérivées, limites (contrôle numérique), développer, factoriser. Pas encore : primitives et intégrales, suites, probabilités, géométrie, démonstrations.' },
  { cle: 'physique-chimie', nom: { fr: 'Sciences physiques', ar: 'العلوم الفيزيائية' }, indices: /physi|chimi/i, types: T('qcm', 'numerique', 'calcul', 'graphique', 'tableau', 'raisonnement'),
    capacites: { resolutionCalcul: false, verificationCalcul: true, unites: true, grilleCriteres: true },
    limites: 'Vérification des calculs et des unités. Pas encore de résolution automatique des lois physiques.' },
  { cle: 'sciences-naturelles', nom: { fr: 'Sciences naturelles', ar: 'علوم الطبيعة' }, indices: /naturel|svt|biolog/i, types: T('qcm', 'texte_court', 'analyse_document', 'figure', 'question_ouverte', 'raisonnement'),
    capacites: { resolutionCalcul: false, verificationCalcul: true, unites: false, grilleCriteres: true },
    limites: 'Corrigé et grille de critères fournis par le pack. Pas encore d’analyse automatique de documents ou de schémas.' },
  { cle: 'francais', nom: { fr: 'Français', ar: 'الفرنسية' }, indices: /fran[cç]ais/i, types: T('qcm', 'texte_court', 'grammaire', 'redaction', 'question_ouverte', 'analyse_document'),
    capacites: { resolutionCalcul: false, verificationCalcul: false, unites: false, grilleCriteres: true },
    limites: 'Notation par grille de critères saisie par le correcteur. Pas encore d’évaluation automatique des rédactions.' },
  { cle: 'arabe', nom: { fr: 'Arabe', ar: 'العربية' }, indices: /arabe|عربي/i, types: T('qcm', 'texte_court', 'grammaire', 'redaction', 'question_ouverte', 'analyse_document'),
    capacites: { resolutionCalcul: false, verificationCalcul: false, unites: false, grilleCriteres: true },
    limites: 'Réponses courtes comparées avec normalisation arabe ; rédactions par grille. Règles à relire par un professeur d’arabe.' },
  { cle: 'anglais', nom: { fr: 'Anglais', ar: 'الإنجليزية' }, indices: /anglais|english/i, types: T('qcm', 'texte_court', 'grammaire', 'traduction', 'redaction'),
    capacites: { resolutionCalcul: false, verificationCalcul: false, unites: false, grilleCriteres: true },
    limites: 'Réponses courtes avec synonymes ; writing par grille.' },
  { cle: 'philosophie', nom: { fr: 'Philosophie', ar: 'الفلسفة' }, indices: /philo/i, types: T('redaction', 'question_ouverte', 'analyse_document'),
    capacites: { resolutionCalcul: false, verificationCalcul: false, unites: false, grilleCriteres: true }, limites: 'Grille de critères (problématique, arguments, structure).' },
  { cle: 'histoire-geographie', nom: { fr: 'Histoire-géographie', ar: 'التاريخ والجغرافيا' }, indices: /histoire|g[ée]ograph/i, types: T('qcm', 'texte_court', 'analyse_document', 'redaction', 'tableau', 'graphique'),
    capacites: { resolutionCalcul: false, verificationCalcul: false, unites: false, grilleCriteres: true }, limites: 'Grille de critères ; réponses courtes (dates, lieux) comparées.' },
  { cle: 'education-islamique', nom: { fr: 'Éducation islamique', ar: 'التربية الإسلامية' }, indices: /islam|إسلام/i, types: T('qcm', 'texte_court', 'redaction', 'question_ouverte'),
    capacites: { resolutionCalcul: false, verificationCalcul: false, unites: false, grilleCriteres: true }, limites: 'Grille de critères ; règles à définir avec des professeurs de la matière.' },
  { cle: 'technique', nom: { fr: 'Matières techniques', ar: 'المواد التقنية' }, indices: /techni|m[ée]cani|[ée]lectro/i, types: T('qcm', 'numerique', 'calcul', 'figure', 'tableau'),
    capacites: { resolutionCalcul: false, verificationCalcul: true, unites: true, grilleCriteres: true }, limites: 'À définir matière par matière avec les sujets officiels.' },
  { cle: 'autre', nom: { fr: 'Autre matière', ar: 'مادة أخرى' }, indices: /$^/, types: T('qcm', 'texte_court', 'redaction'),
    capacites: { resolutionCalcul: false, verificationCalcul: false, unites: false, grilleCriteres: true }, limites: 'Notation par le pack seulement.' },
];

export const moteurMatiere = (cle?: string) => MOTEURS.find((m) => m.cle === cle) ?? MOTEURS[MOTEURS.length - 1];

export interface Detection<T> { valeur: T | null; confiance: 'elevee' | 'moyenne' | 'faible'; indice: string }

/** Matière d'un pack : déclarée (élevée) ou devinée d'après le titre/id (moyenne), jamais certaine. */
export function detecterMatiere(p: Pick<Pack, 'matiere' | 'titre' | 'id'>): Detection<string> {
  if (p.matiere) return { valeur: p.matiere, confiance: 'elevee', indice: 'déclarée dans le pack' };
  const texte = `${p.titre} ${p.id}`;
  const trouves = MOTEURS.filter((m) => m.indices.test(texte));
  if (trouves.length === 1) return { valeur: trouves[0].cle, confiance: 'moyenne', indice: `mot reconnu dans « ${p.titre} »` };
  return { valeur: null, confiance: 'faible', indice: trouves.length ? 'plusieurs matières possibles' : 'aucun indice' };
}

export interface EntreeCatalogue { id: string; titre: string; examen: string; serie: string; matiere: string; annee: string; session: string }

/** Arbre examen → série → matière → liste triée (année, session). Rien n'est inventé : « non précisé » si absent. */
export function construireCatalogue(packs: Pack[]) {
  const np = 'non précisé';
  const entrees: EntreeCatalogue[] = packs.map((p) => ({
    id: p.id, titre: p.titre, examen: p.examen ?? np, serie: p.serie ?? np,
    matiere: detecterMatiere(p).valeur ?? np, annee: p.annee ? String(p.annee) : np, session: p.session ?? np,
  }));
  const arbre: Record<string, Record<string, Record<string, EntreeCatalogue[]>>> = {};
  for (const e of entrees) ((arbre[e.examen] ??= {})[e.serie] ??= {})[e.matiere] = [...(arbre[e.examen]?.[e.serie]?.[e.matiere] ?? []), e];
  for (const ex of Object.values(arbre)) for (const se of Object.values(ex)) for (const k of Object.keys(se)) se[k].sort((a, b) => b.annee.localeCompare(a.annee) || a.session.localeCompare(b.session));
  return arbre;
}
