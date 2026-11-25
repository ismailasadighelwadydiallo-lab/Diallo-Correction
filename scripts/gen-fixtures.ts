// Génère le pack de démonstration et des photos simulées de feuilles-réponses (PNG).
// Usage : npm run fixtures
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { specFeuille, simulerFeuille, coinsDroits, encoderPngGris, validerPack, readSheet, copieDepuisLecture, noterCopie, type Pack, type MarqueSimulee, type OptionsSimulation } from '../packages/oc-core/src/index.ts';

const pack: Pack = {
  format: 'oc-pack/1',
  id: 'demo-devoir-qcm',
  titre: 'Devoir de démonstration (QCM)',
  serie: 'Démo',
  total: 20,
  langue: 'fr',
  regles: { qcm_multi: 'partiel' },
  meta: { source: 'Pack de démonstration généré par scripts/gen-fixtures.ts', auteur: 'Offline Correction' },
  questions: [
    ...Array.from({ length: 14 }, (_, i) => ({
      id: `Ex1-Q${i + 1}`, exercice: 'Ex1', type: 'qcm' as const, enonce: `Question ${i + 1}`, points: 1, choix: ['A', 'B', 'C', 'D'], bonnes: ['ABCD'[(i * 7) % 4]],
    })),
    { id: 'Ex2-Q1', exercice: 'Ex2', type: 'qcm', enonce: 'Plusieurs réponses', points: 1, choix: ['A', 'B', 'C', 'D', 'E'], bonnes: ['B', 'E'] },
    { id: 'Ex2-Q2', exercice: 'Ex2', type: 'qcm', enonce: 'Plusieurs réponses', points: 1, choix: ['A', 'B', 'C', 'D', 'E'], bonnes: ['A', 'C', 'D'] },
    { id: 'Ex3-Q1', exercice: 'Ex3', type: 'redaction', enonce: 'Question ouverte notée par le professeur', points: 2, etapes: [{ critere: 'Raisonnement', points: 1.5 }, { critere: 'Conclusion', points: 0.5 }] },
    { id: 'Ex3-Q2', exercice: 'Ex3', type: 'calcul', enonce: 'Calcul noté par le professeur', points: 2, etapes: [{ critere: 'Méthode', points: 1 }, { critere: 'Résultat', points: 1 }] },
  ],
};
const v = validerPack(pack);
if (!v.ok) throw new Error(v.erreurs.join('\n'));
mkdirSync('packs', { recursive: true });
writeFileSync('packs/demo-devoir-qcm.json', JSON.stringify(pack, null, 2) + '\n');

const items = specFeuille(pack);
const eleves: [string, Record<string, MarqueSimulee>, Partial<OptionsSimulation>][] = [];
// élève 1 : bonnes réponses partout sauf 3, stylo, photo inclinée
const m1: Record<string, MarqueSimulee> = {};
pack.questions.forEach((q, i) => {
  if (q.type === 'qcm') m1[q.id] = { labels: i % 5 === 4 ? [q.choix.find((c) => !q.bonnes.includes(c))!] : q.bonnes };
});
m1['Ex2-Q2'] = { labels: ['A', 'C'] };
m1['Ex3-Q1'] = { labels: ['1,5'] };
m1['Ex3-Q2'] = { labels: ['2'] };
eleves.push(['eleve1-inclinee', m1, { coins: [[150, 120], [780, 160], [80, 1160], [850, 1110]] }]);
// élève 2 : crayon pâle, ombre, une double case
const m2: Record<string, MarqueSimulee> = {};
for (const [k, x] of Object.entries(m1)) m2[k] = { ...x, gris: 150, couverture: 0.75 };
m2['Ex1-Q2'] = { labels: ['A', 'B'], gris: 150 };
eleves.push(['eleve2-crayon-ombre', m2, { ombre: { a: 1, b: 1, c: 1150, facteur: 0.6, douceur: 60 }, eclairage: [1, 0.8] }]);

mkdirSync('fixtures/feuilles', { recursive: true });
for (const [nom, m, o] of eleves) {
  const opt: OptionsSimulation = { largeur: 900, hauteur: 1250, coins: coinsDroits(900, 1250), ...o };
  const g = simulerFeuille(items, m, opt);
  writeFileSync(`fixtures/feuilles/${nom}.png`, encoderPngGris(g, opt.largeur, opt.hauteur, (b) => deflateSync(b, { level: 9 })));
  const r = readSheet(g, opt.largeur, opt.hauteur, items);
  if (!r.ok) throw new Error(nom + ' : ' + r.erreur);
  const res = noterCopie(pack, copieDepuisLecture(items, r.lignes));
  console.log(`${nom}.png → ${res.note}/${res.total} (${res.sur20}/20)${res.douteuse ? ' ⚠️ ' + res.raisons_doute.join(', ') : ''}`);
}
writeFileSync('fixtures/feuilles/demo-feuille.svg', (await import('../packages/oc-core/src/index.ts')).feuilleSVG(items, { titre: pack.titre }));
