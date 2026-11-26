// Corrigé de référence : une fiche par question, construite à partir du pack (corrigé préparé)
// et du moteur de calcul (vérifications, solveur). C'est le MÊME pack qui sert à corriger les
// copies : questions, barème, vérifications et méthodes acceptées sont partagés.
//
// Confiance : quatre catégories séparées, avec des critères fixes (docs/confiance.md).
//  - lecture        : « sans objet » pour un pack (pas de photo lue) ;
//  - compréhension  : élevée si la question vient d'un pack structuré (énoncé, points, type) ;
//  - résolution     : élevée si toutes les vérifications passent ; moyenne si le corrigé vient du
//                     pack sans vérification possible, ou si le solveur donne un résultat approché ;
//                     faible si une vérification échoue ou si un relecteur doit valider ; aucune s'il
//                     n'y a pas de corrigé ;
//  - notation       : élevée avec un barème officiel ; moyenne avec un barème proposé ; faible
//                     sans détail par étape.
import type { Etape, Pack, Question, SourceBareme, MethodeAlternative, EtapeSolution } from '../pack/types.ts';
import { exerciceDe } from '../pack/validate.ts';
import { verifier } from '../math/engine.ts';
import { resoudre, type Controle, type NiveauConfiance } from './solveur.ts';

export type NiveauOuSansObjet = NiveauConfiance | 'sans_objet';

export interface Confiances {
  lecture: NiveauOuSansObjet;
  comprehension: NiveauConfiance;
  resolution: NiveauConfiance;
  notation: NiveauConfiance;
}

export interface FicheQuestion {
  id: string;
  exercice: string;
  enonce: string;
  points: number;
  type: Question['type'];
  /** Origine du corrigé affiché. */
  origine: 'pack' | 'pack_resultat' | 'solveur' | 'aucune';
  comprendre?: string;
  donnees: string[];
  methode?: string;
  etapes: EtapeSolution[];
  resultat?: string;
  reponse?: string;
  bareme: { critere: string; points: number; nature?: Etape['nature'] }[];
  baremeSource: SourceBareme | 'inconnu';
  controles: Controle[];
  alternatives: MethodeAlternative[];
  confiance: Confiances;
  statut: 'resolu' | 'a_verifier' | 'insuffisant';
  raisons: string[];
}

export interface BilanExercice {
  exercice: string;
  points: number;
  questions: number;
  resolues: number;
  aVerifier: number;
  statut: 'resolu' | 'a_verifier';
}

export interface CorrigeComplet {
  pack: { id: string; titre: string; examen?: string; serie?: string; matiere?: string; annee?: number; session?: string; duree?: string; total: number };
  baremeSource: SourceBareme | 'inconnu';
  fiches: FicheQuestion[];
  exercices: BilanExercice[];
  bilan: { questions: number; resolues: number; aVerifier: number; insuffisantes: number };
  avertissements: string[];
}

const pire = (a: NiveauConfiance, b: NiveauConfiance): NiveauConfiance => {
  const ordre: NiveauConfiance[] = ['aucune', 'faible', 'moyenne', 'elevee'];
  return ordre[Math.min(ordre.indexOf(a), ordre.indexOf(b))];
};

/** Fiche de corrigé d'une question. */
export function ficheQuestion(pack: Pack, q: Question): FicheQuestion {
  const raisons: string[] = [];
  const s = q.solution;
  const etapesSol: EtapeSolution[] = s?.etapes ? [...s.etapes] : [];
  let origine: FicheQuestion['origine'] = s && (s.methode || s.etapes?.length || s.resultat) ? 'pack' : q.attendu || (q.type === 'qcm' && q.bonnes.length) ? 'pack_resultat' : 'aucune';
  let resultat = s?.resultat ?? q.attendu;
  if (!resultat && q.type === 'qcm') resultat = `Bonne(s) réponse(s) : ${q.bonnes.join(', ')}`;
  if (!resultat && q.type === 'numerique' && q.valeur !== undefined) resultat = `${q.valeur}${q.unite ? ' ' + q.unite : ''}`;
  if (!resultat && q.type === 'texte_court' && q.reponses?.length) resultat = q.reponses.join(' / ');
  let methode = s?.methode;
  let comprendre = s?.comprendre;
  const donnees = s?.donnees ? [...s.donnees] : [];

  // Vérifications du pack
  const verifs = q.verification ? (Array.isArray(q.verification) ? q.verification : [q.verification]) : [];
  const controles: Controle[] = verifs.map((v) => { const r = verifier(v); return { quoi: v.quoi ?? `${v.type ?? 'egal'} : ${v.expression}`, ok: r.ok, detail: r.detail }; });

  // Corrigé du pack sans méthode rédigée : si une vérification porte sur une dérivée, une équation
  // ou une limite, le solveur local rédige les étapes du calcul (et les vérifie lui-même).
  if (origine === 'pack_resultat' && !methode) {
    for (const v of verifs) {
      const d = /^diff\((.+),\s*([a-z])\s*\)$/.exec(v.expression.trim());
      const demande = d ? `Dériver f(${d[2]}) = ${d[1]}`
        : v.type === 'racines' ? null
        : v.type === 'limite' && v.vers ? `Calculer la limite de ${v.expression} en ${v.vers}` : null;
      if (!demande) continue;
      const r = resoudre(demande);
      if (r.confiance.niveau === 'aucune' || r.controles.some((c) => !c.ok)) continue;
      methode = r.methode;
      etapesSol.push({ texte: `${r.comprendre}` }, ...r.etapes, { texte: `Résultat : ${r.resultat}` });
      raisons.push('étapes du calcul rédigées par le solveur local');
      break;
    }
  }

  // Sans corrigé dans le pack : le solveur local tente la question (maths seulement).
  let resolutionSolveur: NiveauConfiance | null = null;
  if (origine === 'aucune') {
    const r = resoudre(q.enonce);
    if (r.confiance.niveau !== 'aucune') {
      origine = 'solveur';
      comprendre = r.comprendre; methode = r.methode; resultat = r.resultat;
      etapesSol.push(...r.etapes); donnees.push(...r.donnees); controles.push(...r.controles);
      resolutionSolveur = r.confiance.niveau;
      raisons.push('corrigé calculé par le solveur local (aucun corrigé dans le pack)');
    }
  }

  // Confiance de résolution
  let resolution: NiveauConfiance;
  if (origine === 'aucune') { resolution = 'aucune'; raisons.push('⚠️ Information insuffisante : aucun corrigé, et le solveur local ne sait pas traiter cette question'); }
  else if (resolutionSolveur) resolution = resolutionSolveur;
  else if (controles.length && controles.every((c) => c.ok)) { resolution = 'elevee'; raisons.push(`${controles.length} calcul(s) vérifié(s) par le moteur`); }
  else if (controles.some((c) => !c.ok)) { resolution = 'faible'; raisons.push('une vérification du moteur a échoué'); }
  else { resolution = 'moyenne'; raisons.push('corrigé du pack, sans calcul vérifiable par le moteur'); }
  const aRelire = q.a_relire ?? pack.meta?.a_relire?.find((t) => t.startsWith(q.id + ' '));
  if (aRelire) { resolution = pire(resolution, 'faible'); raisons.push(`à relire : ${aRelire}`); }

  // Barème
  const baremeSource: FicheQuestion['baremeSource'] = q.bareme_source ?? pack.bareme_source ?? 'inconnu';
  const bareme = q.etapes?.length ? q.etapes.map((e) => ({ critere: e.critere, points: e.points, nature: e.nature })) : [{ critere: 'Réponse juste', points: q.points }];
  const notation: NiveauConfiance = !q.etapes?.length && !['qcm', 'numerique', 'texte_court'].includes(q.type) ? 'faible' : baremeSource === 'officiel' ? 'elevee' : 'moyenne';
  if (baremeSource !== 'officiel') raisons.push(baremeSource === 'propose' ? 'barème proposé (non officiel)' : 'origine du barème inconnue');

  const confiance: Confiances = { lecture: 'sans_objet', comprehension: 'elevee', resolution, notation };
  const statut: FicheQuestion['statut'] = origine === 'aucune' ? 'insuffisant' : resolution === 'elevee' || resolution === 'moyenne' ? 'resolu' : 'a_verifier';
  return {
    id: q.id, exercice: exerciceDe(q), enonce: q.enonce, points: q.points, type: q.type, origine,
    comprendre, donnees, methode, etapes: etapesSol, resultat, reponse: s?.reponse,
    bareme, baremeSource, controles, alternatives: q.methodes_alternatives ?? [], confiance, statut, raisons,
  };
}

/** Corrigé complet d'une épreuve : fiches, bilan par exercice, questions à vérifier (jamais cachées). */
export function corrigeComplet(pack: Pack): CorrigeComplet {
  const fiches = pack.questions.map((q) => ficheQuestion(pack, q));
  // « Exercice 1 (3 pts) », « Exercice 1 — B », « Exercice 1 (annoncé 6 pts) » : même exercice.
  const cle = (e: string) => e.replace(/\s*—.*$/, '').replace(/\s*\([^)]*\)/g, '').trim();
  const parEx = new Map<string, FicheQuestion[]>();
  const libelle = new Map<string, string>();
  for (const f of fiches) {
    const k = cle(f.exercice);
    parEx.set(k, [...(parEx.get(k) ?? []), f]);
    if (!libelle.has(k)) libelle.set(k, f.exercice.replace(/\s*—.*$/, '').trim());
  }
  const exercices: BilanExercice[] = [...parEx].map(([exercice, fs]) => {
    const resolues = fs.filter((f) => f.statut === 'resolu').length;
    return { exercice: libelle.get(exercice) ?? exercice, points: Math.round(fs.reduce((a, f) => a + f.points, 0) * 100) / 100, questions: fs.length, resolues, aVerifier: fs.length - resolues, statut: resolues === fs.length ? 'resolu' : 'a_verifier' };
  });
  const avertissements: string[] = [];
  if (pack.meta?.avertissement) avertissements.push(pack.meta.avertissement);
  if (pack.meta?.partiel) avertissements.push(`Pack incomplet : ${pack.meta.partiel.manque.join(' ; ')}`);
  return {
    pack: { id: pack.id, titre: pack.titre, examen: pack.examen, serie: pack.serie, matiere: pack.matiere, annee: pack.annee, session: pack.session, duree: pack.duree, total: pack.total },
    baremeSource: pack.bareme_source ?? 'inconnu',
    fiches, exercices,
    bilan: {
      questions: fiches.length,
      resolues: fiches.filter((f) => f.statut === 'resolu').length,
      aVerifier: fiches.filter((f) => f.statut === 'a_verifier').length,
      insuffisantes: fiches.filter((f) => f.statut === 'insuffisant').length,
    },
    avertissements,
  };
}
