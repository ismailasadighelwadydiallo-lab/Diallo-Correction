// « Vérifier mon raisonnement » : le correcteur écrit sa démarche, une étape par ligne.
// Chaque ligne est contrôlée par le moteur de calcul (pas par une IA) :
//  - une chaîne d'égalités A = B = C : chaque égalité doit être une identité ;
//  - une équation : elle doit avoir les mêmes solutions que l'équation précédente ;
//  - « x = 2 ou x = 3 », « S = {2 ; 3} » : ce doivent être exactement les solutions ;
//  - « f'(x) = … », « Δ = … » : la valeur doit suivre la ligne précédente du même nom, et la
//    dérivée de la fonction de la question si elle est connue.
// Après une erreur, une ligne cohérente avec la ligne fausse est marquée « erreur entraînée ».
import { parse, developper, variablesLibres, equivalentes, evaluerNombre } from '../math/engine.ts';
import { racinesReelles, joli } from './solveur.ts';

export type StatutLigne = 'juste' | 'erreur' | 'entrainee' | 'non_lue' | 'info';

export interface LigneVerifiee {
  numero: number;
  texte: string;
  statut: StatutLigne;
  message: string;
}

export interface ContexteRaisonnement {
  /** Fonction de la question (pour contrôler f'(x)). */
  fonction?: string;
  /** Équation de départ, ex. "x^2 - 5x + 6 = 0". */
  equation?: string;
  variable?: string;
  /** Résultat attendu : expression (dérivée, valeur…) ou liste de solutions. */
  attendu?: string | string[];
}

export interface RapportRaisonnement {
  lignes: LigneVerifiee[];
  /** null si aucune comparaison possible avec un résultat attendu. */
  resultatJuste: boolean | null;
  conclusion: string;
}

const MOTS = /^(?:(?:je|j'|on|donc|puis|alors|ainsi|d'où|d'ou|soit|pense|que|qu'|trouve|trouvé|a|ai|obtiens|obtient|calcule|enfin|finalement|ensuite|c'est|est|:|,|⇔|<=>|=>|⇒|->|→)\s*)+/i;

function nettoyer(l: string) {
  return l.replace(MOTS, '').replace(/[.;]\s*$/, '').trim();
}

type Fait =
  | { sorte: 'valeur'; nom: string; expr: string }
  | { sorte: 'chaine'; membres: string[] }
  | { sorte: 'equation'; f: string }
  | { sorte: 'solutions'; valeurs: number[] }
  | { sorte: 'texte' };

const NOM = /^([A-Za-zΔδ][A-Za-z0-9_]*'*(?:\(\s*[a-z]\s*\))?)$/;

function analyser(ligne: string, x: string): Fait {
  const l = nettoyer(ligne).replace(/delta/gi, 'Δ');
  // solutions : « x = 2 ou x = 3 », « x1 = 2 et x2 = 3 », « S = {2 ; 3} »
  const ens = /^S\s*=\s*\{([^}]*)\}$/i.exec(l);
  if (ens) {
    const v = ens[1].split(/[;]|,(?!\d)/).map((t) => evaluerNombre(t.trim())).filter((t): t is number => t !== null);
    return { sorte: 'solutions', valeurs: v };
  }
  if (/\b(ou|et)\b/.test(l) && new RegExp(`^${x}\\w*\\s*=`).test(l)) {
    const v = l.split(/\b(?:ou|et)\b/).map((p) => evaluerNombre(p.split('=').pop()!.trim()));
    if (v.every((t) => t !== null)) return { sorte: 'solutions', valeurs: v as number[] };
  }
  if (!l.includes('=')) {
    return lisible(l) ? { sorte: 'chaine', membres: [l] } : { sorte: 'texte' };
  }
  const morceaux = l.split('=').map((t) => t.trim());
  // « f'(x) = … », « Δ = … », « u = … » : nom puis valeur(s)
  if (NOM.test(morceaux[0]) && (morceaux[0].includes("'") || morceaux[0].includes('(') || /^[Δδ]$/.test(morceaux[0]) || (morceaux[0] !== x && morceaux.length >= 2 && variablesLibresSur(morceaux.slice(1)).every((v) => v === x)))) {
    const valeurs = morceaux.slice(1);
    if (valeurs.every(lisible)) {
      if (valeurs.length === 1 && morceaux[0] === x && evaluerNombre(valeurs[0]) !== null) return { sorte: 'solutions', valeurs: [evaluerNombre(valeurs[0])!] };
      return valeurs.length === 1 ? { sorte: 'valeur', nom: morceaux[0].replace(/\s/g, ''), expr: valeurs[0] } : { sorte: 'valeur', nom: morceaux[0].replace(/\s/g, ''), expr: valeurs.join(' = ') };
    }
  }
  if (!morceaux.every(lisible)) return { sorte: 'texte' };
  if (morceaux.length === 2 && morceaux[0] === x && evaluerNombre(morceaux[1]) !== null) return { sorte: 'solutions', valeurs: [evaluerNombre(morceaux[1])!] };
  // identité (chaîne de calcul) ou équation ?
  if (morceaux.length >= 2 && equivalentes(morceaux[0], morceaux[1])) return { sorte: 'chaine', membres: morceaux };
  if (morceaux.length === 2) return { sorte: 'equation', f: `(${morceaux[0]}) - (${morceaux[1]})` };
  return { sorte: 'chaine', membres: morceaux };
}

/** Lisible par le moteur : s'analyse, et ses variables sont des lettres seules (x, y, z, a, k…), pas des mots. */
function lisible(e: string) {
  try {
    const n = developper(parse(e));
    return e.length > 0 && variablesLibres(n).every((v) => /^([a-zA-Z][0-9]?|alpha|beta|theta|lambda|Δ)$/.test(v));
  } catch { return false; }
}
function variablesLibresSur(es: string[]) { try { return es.flatMap((e) => variablesLibres(parse(e))); } catch { return ['?']; } }

const memesEnsembles = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6 * Math.max(1, Math.abs(v)));
const txtEns = (v: number[]) => `{ ${v.map((t) => String(Number(t.toPrecision(8))).replace('.', ',')).join(' ; ')} }`;

export function verifierRaisonnement(texte: string, ctx: ContexteRaisonnement = {}): RapportRaisonnement {
  const x = ctx.variable ?? 'x';
  const sortie: LigneVerifiee[] = [];
  let erreurAvant = false;
  const valeurs = new Map<string, string>();
  let equation: { f: string; racines: number[] } | null = null;
  if (ctx.equation) {
    const [g, d] = ctx.equation.split('=');
    const f = d !== undefined ? `(${g}) - (${d})` : g;
    equation = { f, racines: racinesReelles(f, x).racines };
  }
  type Dernier = { sorte: 'expr'; expr: string } | { sorte: 'solutions'; valeurs: number[] };
  const etat: { dernier: Dernier | null } = { dernier: null };

  const lignes = texte.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  lignes.forEach((brut, i) => {
    const num = i + 1;
    const f = analyser(brut, x);
    const marquer = (ok: boolean, msgOk: string, msgKo: string, coherentAvecErreur = false) => {
      if (ok) sortie.push({ numero: num, texte: brut, statut: erreurAvant && coherentAvecErreur ? 'entrainee' : 'juste', message: erreurAvant && coherentAvecErreur ? `${msgOk} (cohérent avec l'étape fausse : erreur entraînée)` : msgOk });
      else { sortie.push({ numero: num, texte: brut, statut: 'erreur', message: msgKo }); erreurAvant = true; }
    };
    if (f.sorte === 'texte') { sortie.push({ numero: num, texte: brut, statut: 'non_lue', message: '⚠️ Ligne non lue par le moteur de calcul (texte, ou écriture non reconnue).' }); return; }

    if (f.sorte === 'chaine') {
      const m = f.membres;
      if (m.length === 1) { sortie.push({ numero: num, texte: brut, statut: 'info', message: `Expression lue : ${joli(m[0])}` }); etat.dernier = { sorte: 'expr', expr: m[0] }; return; }
      const k = m.findIndex((e, j) => j > 0 && !equivalentes(m[j - 1], e));
      marquer(k < 0, 'Calcul juste : chaque égalité est vraie.', `✗ Erreur de calcul : ${joli(m[k - 1])} n'est pas égal à ${joli(m[k])}.`);
      etat.dernier = { sorte: 'expr', expr: m[m.length - 1] };
      return;
    }

    if (f.sorte === 'valeur') {
      const membres = f.expr.split('=').map((t) => t.trim());
      const k = membres.findIndex((e, j) => j > 0 && !equivalentes(membres[j - 1], e));
      const avant = valeurs.get(f.nom);
      const nomBase = f.nom.replace(/\(.*$/, '');
      const derivee = /'$/.test(nomBase) && ctx.fonction ? `diff(${ctx.fonction}, ${x}, ${nomBase.split("'").length - 1})` : null;
      if (k >= 0) marquer(false, '', `✗ Erreur de calcul dans la ligne : ${joli(membres[k - 1])} ≠ ${joli(membres[k])}.`);
      else if (avant !== undefined) {
        const ok = equivalentes(avant, membres[0]);
        if (!ok && derivee && equivalentes(derivee, membres[0])) marquer(true, `${f.nom} juste (dérivée vérifiée).`, '');
        else marquer(ok, `Suite juste : même valeur que la ligne précédente pour ${f.nom}.`, `✗ Erreur : cette valeur de ${f.nom} n'est pas égale à celle de la ligne précédente (${joli(avant)}).`, true);
      } else if (derivee) {
        const ok = equivalentes(derivee, membres[0]);
        marquer(ok, `${f.nom} juste (dérivée de ${joli(ctx.fonction!)} vérifiée).`, `✗ Formule ou calcul de dérivée faux : ${f.nom} ne vaut pas ${joli(membres[0])}.`);
      } else sortie.push({ numero: num, texte: brut, statut: 'info', message: `${f.nom} = ${joli(membres[membres.length - 1])} (rien à comparer : première valeur de ${f.nom}).` });
      valeurs.set(f.nom, membres[membres.length - 1]);
      etat.dernier = { sorte: 'expr', expr: membres[membres.length - 1] };
      return;
    }

    if (f.sorte === 'equation') {
      const r = racinesReelles(f.f, x).racines;
      if (!equation) sortie.push({ numero: num, texte: brut, statut: 'info', message: `Équation de départ. Solutions réelles (moteur) : ${txtEns(r)}.` });
      else marquer(memesEnsembles(equation.racines, r), 'Transformation juste : même ensemble de solutions.', `✗ Erreur : cette équation n'a pas les mêmes solutions que la précédente (${txtEns(equation.racines)} → ${txtEns(r)}).`, true);
      equation = { f: f.f, racines: r };
      return;
    }

    // solutions
    const v = [...f.valeurs].sort((a, b) => a - b);
    etat.dernier = { sorte: 'solutions', valeurs: v };
    if (!equation) { sortie.push({ numero: num, texte: brut, statut: 'info', message: `Solutions annoncées ${txtEns(v)} (aucune équation à laquelle les comparer).` }); return; }
    const fausses = v.filter((s) => { const y = evaluerNombre(equation!.f, { [x]: s }); return y === null || Math.abs(y) > 1e-6; });
    const manquantes = equation.racines.filter((s) => !v.some((t) => Math.abs(t - s) < 1e-6));
    marquer(!fausses.length && !manquantes.length, 'Solutions justes pour l\'équation de la ligne précédente : aucune fausse, aucune manquante.',
      fausses.length ? `✗ ${txtEns(fausses)} ne vérifie pas l'équation de la ligne précédente.` : `✗ Il manque des solutions : ${txtEns(manquantes)}.`, true);
  });

  // Comparaison avec le résultat attendu de la question
  let resultatJuste: boolean | null = null;
  const fin = etat.dernier;
  if (ctx.attendu !== undefined && fin) {
    if (Array.isArray(ctx.attendu)) {
      const att = ctx.attendu.map((t) => evaluerNombre(t)).filter((t): t is number => t !== null).sort((a, b) => a - b);
      resultatJuste = fin.sorte === 'solutions' ? memesEnsembles(att, fin.valeurs) : null;
    } else resultatJuste = fin.sorte === 'expr' ? equivalentes(ctx.attendu, fin.expr) : null;
  }
  const premiereErreur = sortie.find((l) => l.statut === 'erreur');
  let conclusion: string;
  if (resultatJuste === true && !premiereErreur) conclusion = '✓ Raisonnement juste et résultat final juste.';
  else if (resultatJuste === true) conclusion = `⚠️ Résultat final juste, mais l'étape ${premiereErreur!.numero} est fausse : méthode à revoir. Vérification humaine recommandée.`;
  else if (resultatJuste === false) conclusion = premiereErreur ? `✗ Le raisonnement devient faux à l'étape ${premiereErreur.numero}. Résultat final attendu : ${Array.isArray(ctx.attendu) ? txtEns(ctx.attendu.map(Number)) : joli(String(ctx.attendu))}.` : `✗ Toutes les étapes lues sont cohérentes, mais le résultat final n'est pas celui attendu (${Array.isArray(ctx.attendu) ? txtEns(ctx.attendu.map(Number)) : joli(String(ctx.attendu))}). Vérifiez l'énoncé et les lignes non lues.`;
  else if (premiereErreur) conclusion = `✗ Le raisonnement devient faux à l'étape ${premiereErreur.numero}.`;
  else if (sortie.some((l) => l.statut === 'juste')) conclusion = '✓ Toutes les étapes vérifiables sont justes.';
  else conclusion = '⚠️ Information insuffisante : rien de vérifiable dans ce texte.';
  if (sortie.some((l) => l.statut === 'non_lue')) conclusion += ' Certaines lignes n\'ont pas été lues par le moteur.';
  return { lignes: sortie, resultatJuste, conclusion };
}
