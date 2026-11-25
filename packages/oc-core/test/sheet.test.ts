import { describe, expect, it } from 'vitest';
import {
  specFeuille, readSheet, copieDepuisLecture, noterCopie, simulerFeuille, coinsDroits, feuilleSVG, homography, casesPoints,
  type Pack, type MarqueSimulee, type OptionsSimulation, type Point,
} from '../src/index.ts';

// Épreuve de 30 questions : QCM simples, QCM à plusieurs réponses, questions notées par l'enseignant.
const pack: Pack = {
  format: 'oc-pack/1', id: 'sim', titre: 'Feuille simulée', total: 0, langue: 'fr',
  questions: Array.from({ length: 30 }, (_, i) => {
    if (i % 10 === 7) return { id: `Q${i + 1}`, type: 'redaction', enonce: '', points: 1.25, etapes: [{ critere: 'tout', points: 1.25 }] } as const;
    if (i % 10 === 3) return { id: `Q${i + 1}`, type: 'qcm', enonce: '', points: 1, choix: ['A', 'B', 'C', 'D', 'E'], bonnes: ['A', 'D'] } as const;
    return { id: `Q${i + 1}`, type: 'qcm', enonce: '', points: 1, choix: ['A', 'B', 'C', 'D'], bonnes: ['ABCD'[i % 4]] } as const;
  }),
};
pack.total = pack.questions.reduce((a, q) => a + q.points, 0);
const items = specFeuille(pack);

/** Réponses d'un élève fictif : on varie les lettres, une case vide, une double, un multi, des points. */
function reponsesEleve(): Record<string, MarqueSimulee> {
  const m: Record<string, MarqueSimulee> = {};
  items.forEach((it, i) => {
    if (it.type === 'points') m[it.id] = { labels: [it.labels[(i % it.labels.length)]] };
    else if (it.multi) m[it.id] = { labels: ['A', 'D'] };
    else m[it.id] = { labels: ['ABCD'[(i * 3) % 4]] };
  });
  delete m['Q5']; // case vide
  m['Q6'] = { labels: ['A', 'C'] }; // deux cases cochées sur un QCM simple
  return m;
}

function attendu(m: Record<string, MarqueSimulee>) {
  return items.map((it) => {
    const l = m[it.id]?.labels ?? [];
    if (!l.length) return { marques: [], statut: 'vide' };
    if (l.length > 1 && !it.multi) return { marques: [...l].sort(), statut: 'multiple' };
    return { marques: [...l].sort(), statut: 'ok' };
  });
}

function lire(m: Record<string, MarqueSimulee>, o: OptionsSimulation) {
  const g = simulerFeuille(items, m, o);
  const r = readSheet(g, o.largeur, o.hauteur, items);
  if (!r.ok) throw new Error(r.erreur);
  return r;
}

const base = (): OptionsSimulation => ({ largeur: 900, hauteur: 1250, coins: coinsDroits(900, 1250) });
// perspective : la feuille est photographiée en biais (trapèze) et tournée de quelques degrés
const incline: [Point, Point, Point, Point] = [[160, 110], [790, 170], [70, 1170], [860, 1100]];

describe('lecture des feuilles simulées', () => {
  const m = reponsesEleve();
  const cas: [string, () => OptionsSimulation][] = [
    ['feuille droite, bonne lumière', base],
    ['photo inclinée (perspective + rotation)', () => ({ ...base(), coins: incline })],
    ['ombre de la main / du téléphone sur la moitié des cases', () => ({ ...base(), coins: incline, ombre: { a: 1, b: 1, c: 1100, facteur: 0.55, douceur: 40 } })],
    ['ombre franche (sans flou) en travers des cases', () => ({ ...base(), ombre: { a: 1, b: 1, c: 1150, facteur: 0.6 } })],
    ['éclairage inégal (dégradé 1,0 → 0,55) et bruit fort', () => ({ ...base(), eclairage: [1, 0.55], bruit: 18 })],
    ['petite photo (600 px de haut)', () => ({ largeur: 450, hauteur: 600, coins: coinsDroits(450, 600, 0.95) })],
  ];
  for (const [nom, opt] of cas) {
    it(nom, () => {
      const r = lire(m, opt());
      expect(r.lignes.map((l) => ({ marques: l.marques, statut: l.statut }))).toEqual(attendu(m));
    });
  }

  // Limite connue (héritée de correcteur.html) : une ombre franche qui coupe un repère noir
  // empêche de le trouver. L'application affiche alors « carrés non trouvés » et demande une autre photo.
  it('limite connue : ombre franche coupant un repère → photo refusée proprement', () => {
    const o = { ...base(), coins: incline, ombre: { a: 1, b: -0.4, c: 450, facteur: 0.55 } };
    const g = simulerFeuille(items, m, o);
    const r = readSheet(g, o.largeur, o.hauteur, items);
    // soit la lecture échoue proprement, soit elle est juste : jamais une note fausse silencieuse
    if (r.ok) {
      const ok = JSON.stringify(r.lignes.map((l) => ({ marques: l.marques, statut: l.statut }))) === JSON.stringify(attendu(m));
      const signale = r.lignes.some((l) => l.statut !== 'ok' && l.statut !== 'vide');
      expect(ok || signale).toBe(true);
    }
  });

  it('crayon pâle (gris 160 sur papier 235), mal rempli', () => {
    const pale: Record<string, MarqueSimulee> = {};
    for (const [k, v] of Object.entries(m)) pale[k] = { ...v, gris: 160, couverture: 0.7 };
    const r = lire(pale, { ...base(), coins: incline, eclairage: [1, 0.75] });
    expect(r.lignes.map((l) => ({ marques: l.marques, statut: l.statut }))).toEqual(attendu(m));
  });

  it('confiance : élevée pour une lecture nette, signal pour une double case', () => {
    const r = lire(m, base());
    const q1 = r.lignes[0];
    expect(q1.confiance).toBeGreaterThanOrEqual(0.9);
    const copie = copieDepuisLecture(items, r.lignes, 'Élève simulé');
    const res = noterCopie(pack, copie);
    expect(res.douteuse).toBe(true);
    expect(res.raisons_doute).toContain('Q6 : plusieurs cases cochées');
  });

  it('feuille sans repères : message clair', () => {
    const g = new Uint8Array(400 * 500).fill(230);
    const r = readSheet(g, 400, 500, items);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/4 carrés noirs/);
  });

  it('chaîne complète : lecture → copie → note', () => {
    const r = lire(m, { ...base(), coins: incline });
    const res = noterCopie(pack, copieDepuisLecture(items, r.lignes));
    // calcul attendu à la main à partir des marques simulées
    let pts = 0;
    pack.questions.forEach((q, i) => {
      const l = m[q.id]?.labels ?? [];
      if (q.type === 'qcm') {
        const ok = [...l].sort().join() === [...q.bonnes].sort().join();
        pts += ok ? q.points : 0;
      } else pts += items[i].valeurs![items[i].labels.indexOf(l[0])];
    });
    expect(res.note).toBe(pts);
  });
});

describe('feuille-réponse', () => {
  it('cases de points au quart de point', () => {
    expect(casesPoints(1.25)).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25]);
    expect(casesPoints(2)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(casesPoints(5)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(casesPoints(8).length).toBeLessThanOrEqual(6);
    expect(casesPoints(8).at(-1)).toBe(8);
  });
  it('SVG imprimable avec 4 repères et toutes les cases', () => {
    const svg = feuilleSVG(items, { titre: 'Test <&>' });
    expect(svg.match(/<rect x=/g)!.length).toBe(4);
    expect(svg.match(/<circle/g)!.length).toBe(items.reduce((a, it) => a + it.labels.length, 0));
    expect(svg).toContain('Test &lt;&amp;&gt;');
  });
  it('trop de questions : erreur explicite', () => {
    const gros = { ...pack, questions: Array.from({ length: 41 }, (_, i) => ({ ...pack.questions[0], id: 'x' + i })) };
    expect(() => specFeuille(gros)).toThrow(/au plus 40/);
  });
  it('homographie : retrouve les 4 coins', () => {
    const T = homography([[0, 0], [1, 0], [0, 1], [1, 1]], [[10, 10], [110, 20], [5, 205], [120, 190]]);
    expect(T(1, 1)[0]).toBeCloseTo(120);
    expect(T(0, 1)[1]).toBeCloseTo(205);
  });
});
