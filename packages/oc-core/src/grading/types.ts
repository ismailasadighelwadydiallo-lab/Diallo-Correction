// Copie d'élève (ce qui a été lu ou saisi) et résultat de la notation.

export type StatutEtape = 'juste' | 'faux' | 'absent';
/** D'où vient une information : la feuille lue par la caméra, l'enseignant, ou (plus tard) une IA. */
export type Source = 'feuille' | 'enseignant' | 'ia' | 'calcul';

export interface Lecture {
  /** 0 à 1 : certitude de la lecture de la photo pour cette question. */
  confiance: number;
  statut?: 'ok' | 'vide' | 'multiple' | 'incertain';
}

export interface ReponseQcm { choix: string[]; lecture?: Lecture }
export interface ReponseNumerique { valeur: string; lecture?: Lecture }
export interface ReponseTexte { texte: string; lecture?: Lecture }
export interface ReponseEtape {
  /** Valeur écrite par l'élève (expression), vérifiée par le moteur de calcul si l'étape a un `attendu`. */
  valeur?: string;
  /** Jugement direct (enseignant, IA) pour les étapes non calculables. */
  statut?: StatutEtape;
  source?: Source;
}
export interface ReponseEtapes {
  etapes: Record<string, ReponseEtape>;
  /** Méthode différente du corrigé (règle 7) : résultat final de l'élève, et s'il est justifié. */
  methode_alternative?: { valeur: string; justifiee: boolean; source?: Source };
  lecture?: Lecture;
}
/** Points notés par l'enseignant directement sur la feuille (cases de points). */
export interface ReponsePoints { points: number; lecture?: Lecture }

export type Reponse = ReponseQcm | ReponseNumerique | ReponseTexte | ReponseEtapes | ReponsePoints;

export interface Copie {
  eleve?: string;
  reponses: Record<string, Reponse | undefined>;
}

export interface ResultatEtape {
  id: string;
  critere: string;
  points: number;
  max: number;
  /** Explication courte si des points sont retirés (ou si l'erreur entraînée s'applique). */
  explication?: string;
  entrainee?: boolean;
}

export interface Confiance {
  /** Certitude de la lecture de la photo (1 si saisie manuelle). */
  lecture: number;
  /** Certitude de la notation automatique. */
  notation: number;
}

export interface ResultatQuestion {
  id: string;
  exercice: string;
  points: number;
  max: number;
  etapes: ResultatEtape[];
  explications: string[];
  confiance: Confiance;
  /** Note modifiée par l'enseignant (la note automatique reste dans `points_auto`). */
  modifiee?: boolean;
  points_auto?: number;
}

export interface Modification {
  question: string;
  ancien: number;
  nouveau: number;
  motif?: string;
  date: string;
}

export interface Resultat {
  note: number;
  total: number;
  sur20: number;
  questions: ResultatQuestion[];
  confiance: Confiance;
  /** Copie signalée à revoir (ne bloque rien). */
  douteuse: boolean;
  raisons_doute: string[];
  modifications: Modification[];
}
