// Convertit les packs « Pack Bac Mauritanie » (format de préparation) au format oc-pack/1,
// ajoute les vérifications du moteur de calcul (scripts/verifications-bac.ts) et les valide.
// Usage : node scripts/convertir-packs-bac.ts <dossier-source> [dossier-sortie=packs]
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validerPack, type Etape, type Pack, type Question, type Verification } from '../packages/oc-core/src/index.ts';
import { VERIFICATIONS } from './verifications-bac.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Src = any;

const nombreTexte = (n: number) => [String(n), String(n).replace('.', ',')];

function convertirQuestion(q: Src, notes: string[]): Question {
  const etapes: Etape[] = (q.etapes ?? []).map((e: Src) => ({ critere: e.critere, points: e.points }));
  const base: Record<string, unknown> = { id: q.id, exercice: q.exercice, enonce: q.enonce, points: q.points, type: q.type, attendu: q.attendu };
  const controles: string[] = [];
  const verifs: Verification[] = [];
  if (q.verification) {
    if (q.verification.expression) verifs.push({ moteur: 'math', expression: q.verification.expression, ...(q.verification.egal_a ? { egal_a: q.verification.egal_a } : {}), quoi: 'vérification du pack d\'origine' });
    if (q.verification.controle) controles.push(`${q.verification.controle} (contrôle déclaré par le pack d'origine)`);
  }
  // relecture
  if (q.confiance === 'a_valider') {
    base.a_relire = q.note ?? 'Réponse à valider par un professeur.';
    notes.push(`${q.id} : ${base.a_relire}`);
  } else if (q.confiance === 'moyenne') {
    base.a_relire = `Confiance moyenne du corrigé proposé${q.note ? ' — ' + q.note : ''}`;
    notes.push(`${q.id} : ${base.a_relire}`);
  } else if (q.note) base.consigne = q.note;

  if (q.type === 'qcm') {
    const cles = Object.keys(q.choix);
    base.choix = cles;
    base.bonnes = q.bonnes_reponses;
    base.enonce = `${q.enonce}\n${cles.map((k) => `${k}) ${q.choix[k]}`).join(' ; ')}`;
    // regle_qcm "plusieurs" : la règle (tout ou rien / partiel) est choisie par l'enseignant au niveau du pack
  } else {
    base.etapes = etapes;
  }

  if (q.type === 'numerique' && q.valeurs) {
    const entrees = Object.entries(q.valeurs as Record<string, { valeur: number; unite?: string; tolerance?: number }>);
    if (entrees.length === 1 && etapes.length === 1) {
      const [, x] = entrees[0];
      base.valeur = x.valeur;
      if (x.unite) base.unite = x.unite;
      if (x.tolerance) base.tolerance = { relative: x.tolerance };
      delete base.etapes;
    } else {
      for (const [nom, x] of entrees) {
        const e = etapes.find((et) => nombreTexte(x.valeur).some((t) => new RegExp(`(^|[^0-9.,])${t.replace('.', '\\.')}([^0-9]|$)`).test(et.critere)));
        if (e && !e.attendu) {
          e.attendu = String(x.valeur);
          if (x.tolerance) e.tolerance = x.tolerance;
        } else controles.push(`Valeur attendue ${nom} = ${String(x.valeur).replace('.', ',')}${x.unite ? ' ' + x.unite : ''}${x.tolerance ? ` (tolérance ${x.tolerance * 100} %)` : ''}, non rattachée à une étape.`);
      }
    }
  }
  if (q.synonymes) {
    for (const [cle, liste] of Object.entries(q.synonymes as Record<string, string[]>)) {
      const e = etapes.find((et) => et.critere === cle) ?? etapes.find((et) => new RegExp(`(^|\\s)${cle}$`).test(et.critere));
      if (e) e.reponses = liste;
      else controles.push(`Synonymes acceptés pour ${cle} : ${liste.join(', ')}.`);
    }
  }
  if (verifs.length) base.verification = verifs;
  if (controles.length) base.controles = controles;
  return base as unknown as Question;
}

export function convertir(src: Src, avertissement?: string): Pack {
  const notes: string[] = [];
  const questions = src.questions.map((q: Src) => convertirQuestion(q, notes));
  // vérifications ajoutées (étape 7)
  const ajouts = VERIFICATIONS[src.id] ?? {};
  for (const q of questions) {
    const add = ajouts[q.id];
    if (!add) continue;
    const existantes = [q.verification ?? []].flat().filter((v) => v.egal_a || v.type);
    q.verification = [...existantes, ...add];
  }
  const matiereDe = (id: string) => /math/i.test(id) ? 'mathematiques' : /physi/i.test(id) ? 'physique-chimie' : /naturel/i.test(id) ? 'sciences-naturelles' : undefined;
  const somme = Math.round(questions.reduce((a: number, q: Question) => a + q.points, 0) * 100) / 100;
  const pack: Pack = {
    format: 'oc-pack/1',
    id: src.id,
    titre: src.titre + (somme !== src.total ? ` (partiel : ${String(somme).replace('.', ',')} pts)` : ''),
    serie: src.serie,
    examen: 'Baccalauréat',
    matiere: matiereDe(src.id),
    annee: Number(src.annee) || undefined,
    // le « Pack Bac Mauritanie » donne des barèmes PROPOSÉS, pas le barème officiel
    bareme_source: 'propose',
    duree: src.duree,
    session: `${src.annee} ${src.session}`,
    total: somme,
    langue: src.langue,
    regles: { qcm_negatif: !!src.regles?.qcm_points_negatifs },
    questions,
    meta: {
      source: `${src.source}. Converti depuis le « Pack Bac Mauritanie » (corrigé et barème proposés, non officiels). Coefficient : ${src.coefficient}.`,
      auteur: 'Pack Bac Mauritanie (proposé) + vérifications Offline Correction',
      cree_le: new Date().toISOString().slice(0, 10),
      ...(avertissement ? { avertissement } : {}),
      ...(somme !== src.total ? { partiel: { total_epreuve: src.total, manque: [...(src.pages_manquantes ?? []), ...(src.remarque_bareme ? [src.remarque_bareme] : [])] } } : {}),
      a_relire: [...notes, ...(src.remarque_bareme ? [`Barème : ${src.remarque_bareme}`] : [])],
    },
  };
  return pack;
}

if (import.meta.main ?? process.argv[1]?.endsWith('convertir-packs-bac.ts')) {
  const [dir, out = 'packs'] = process.argv.slice(2);
  if (!dir || !existsSync(dir)) { console.error('Usage : node scripts/convertir-packs-bac.ts <dossier-source> [dossier-sortie]'); process.exit(2); }
  const index = existsSync(join(dir, 'index.json')) ? JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) : {};
  let ko = 0;
  for (const f of readdirSync(dir).filter((x) => x.startsWith('bac-') && x.endsWith('.json')).sort()) {
    const pack = convertir(JSON.parse(readFileSync(join(dir, f), 'utf8')), index.avertissement);
    const v = validerPack(pack);
    if (!v.ok) ko++;
    writeFileSync(join(out, f), JSON.stringify(pack, null, 2) + '\n');
    console.log(`${v.ok ? '✅' : '❌'} ${f} — ${pack.questions.length} questions, ${pack.total} pts${pack.meta?.partiel ? ' (partiel)' : ''}${v.ok ? '' : '\n   ' + v.erreurs.join('\n   ')}`);
  }
  process.exit(ko ? 1 : 0);
}
