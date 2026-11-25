// Format d'un pack d'épreuve (version "oc-pack/1").
// Le schéma JSON équivalent est dans ./schema.ts ; la validation dans ./validate.ts.

export type Langue = 'fr' | 'ar';
export type TypeQuestion = 'qcm' | 'numerique' | 'texte_court' | 'calcul' | 'demonstration' | 'figure' | 'redaction';
/** Nature d'une étape du barème (section 7, règle 1). `critere` = élément d'une grille (figures, rédaction). */
export type NatureEtape = 'methode' | 'calcul' | 'resultat' | 'justification' | 'critere';
export type RegleQcmMulti = 'tout_ou_rien' | 'partiel';

/**
 * Vérification par le moteur de calcul.
 * - `egal`    : `expression` et `egal_a` sont équivalentes (comparaison numérique sur des points tirés au hasard).
 *               `expression` peut contenir diff(f, x) (dérivée symbolique).
 * - `racines` : chaque valeur de `valeurs` annule `expression`.
 * - `primitive` : la dérivée de `egal_a` par rapport à `variable` est égale à `expression`.
 */
export interface Verification {
  moteur: 'math';
  type?: 'egal' | 'racines' | 'primitive';
  expression: string;
  egal_a?: string;
  valeurs?: (number | string)[];
  variable?: string;
}

export interface Etape {
  /** Identifiant unique dans la question (ex. "derivee"). Par défaut "e1", "e2"… */
  id?: string;
  critere: string;
  points: number;
  nature?: NatureEtape;
  /**
   * Valeur attendue, sous forme d'expression math.js. Elle peut utiliser les variables
   * d'étapes précédentes (champ `variable`) : c'est ce qui permet de gérer l'erreur entraînée.
   */
  attendu?: string;
  /** Nom sous lequel la valeur de cette étape est réutilisée par les étapes suivantes. */
  variable?: string;
  /** Tolérance relative pour comparer les valeurs (défaut 1e-6). */
  tolerance?: number;
}

interface QuestionBase {
  id: string;
  /** Regroupement pour les statistiques (ex. "Ex2"). Par défaut : partie de l'id avant le premier "-". */
  exercice?: string;
  enonce: string;
  points: number;
  type: TypeQuestion;
  /** Corrigé lisible par l'enseignant. */
  attendu?: string;
  verification?: Verification;
  etapes?: Etape[];
  /** Note pour le professeur relecteur : ce qui n'a pas pu être vérifié automatiquement. */
  a_relire?: string;
}

export interface QuestionQcm extends QuestionBase {
  type: 'qcm';
  /** Étiquettes des choix, ex. ["A","B","C","D"]. */
  choix: string[];
  /** Une ou plusieurs bonnes réponses. */
  bonnes: string[];
  /** Pour les QCM à plusieurs réponses. Par défaut : règle du pack, sinon "tout_ou_rien". */
  regle_multi?: RegleQcmMulti;
  /** Points retirés par mauvaise réponse, appliqués seulement si `regles.qcm_negatif` est vrai. */
  penalite?: number;
}

export interface QuestionNumerique extends QuestionBase {
  type: 'numerique';
  valeur: number;
  tolerance?: { absolue?: number; relative?: number };
  /** Unité de référence de `valeur` (ex. "m/s"). */
  unite?: string;
  /** Autres unités acceptées et leur facteur vers l'unité de référence (ex. {"km/h": 0.2777778}). */
  unites?: Record<string, number>;
  /** Points retirés si l'unité manque (défaut 0,25). */
  penalite_unite?: number;
}

export interface QuestionTexteCourt extends QuestionBase {
  type: 'texte_court';
  /** Réponses acceptées (synonymes). Majuscules, accents, espaces et ponctuation ignorés. */
  reponses: string[];
}

export interface QuestionEtapes extends QuestionBase {
  type: 'calcul' | 'demonstration' | 'figure' | 'redaction';
  etapes: Etape[];
  /** « Montrer que… » : le résultat seul, sans démonstration, vaut 0. Vrai par défaut pour `demonstration`. */
  montrer_que?: boolean;
}

export type Question = QuestionQcm | QuestionNumerique | QuestionTexteCourt | QuestionEtapes;

export interface ReglesPack {
  qcm_multi?: RegleQcmMulti;
  /** Points négatifs aux QCM (seulement si le sujet le dit). Défaut : faux. */
  qcm_negatif?: boolean;
  /** Seuil de confiance sous lequel une copie est signalée « à revoir » (défaut 0,7). */
  seuil_confiance?: number;
}

export interface Pack {
  format: 'oc-pack/1';
  id: string;
  titre: string;
  serie?: string;
  duree?: string;
  session?: string;
  total: number;
  langue: Langue;
  regles?: ReglesPack;
  questions: Question[];
  meta?: {
    source?: string;
    auteur?: string;
    cree_le?: string;
    /** Points que le corrigé n'a pas pu vérifier et qu'un professeur doit relire. */
    a_relire?: string[];
  };
}
