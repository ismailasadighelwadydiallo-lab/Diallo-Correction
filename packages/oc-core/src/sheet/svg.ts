// Feuille-réponse imprimable en SVG (reprise de sheetSVG de correcteur.html).
import { H, MK, MARKER_SIZE, W } from './geometry.ts';
import { layout, type ItemFeuille } from './layout.ts';

const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface TextesFeuille {
  titre: string;
  sousTitre?: string;
  nom?: string;
  consigne?: string;
  piedDePage?: string;
}

const DEFAUT: Required<Omit<TextesFeuille, 'titre' | 'sousTitre'>> = {
  nom: 'Nom et prénom : ..............................................................................',
  consigne: 'Noircissez complètement la case. QCM marqués ** : plusieurs réponses possibles.',
  piedDePage: '* question notée par le correcteur : il noircit le nombre de points obtenus',
};

export function feuilleSVG(items: ItemFeuille[], t: TextesFeuille): string {
  const tx = { ...DEFAUT, ...t };
  const L = layout(items);
  const m = MARKER_SIZE / 2;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial,Helvetica,sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
  MK.forEach(([x, y]) => (s += `<rect x="${x - m}" y="${y - m}" width="${MARKER_SIZE}" height="${MARKER_SIZE}" fill="#000"/>`));
  s += `<text x="500" y="125" text-anchor="middle" font-size="30" font-weight="700">${esc(tx.titre)}</text>`;
  if (tx.sousTitre) s += `<text x="500" y="165" text-anchor="middle" font-size="20" fill="#444">${esc(tx.sousTitre)}</text>`;
  s += `<text x="95" y="225" font-size="22">${esc(tx.nom)}</text>
  <text x="95" y="275" font-size="17" fill="#333">${esc(tx.consigne)}</text>
  <line x1="95" y1="300" x2="905" y2="300" stroke="#000" stroke-width="2"/>`;
  L.forEach((q, i) => {
    const it = items[i];
    const marque = it.type === 'points' ? '*' : it.multi ? '**' : '';
    s += `<text x="${q.x0}" y="${q.y + 7}" font-size="21" font-weight="700">${it.numero}${marque}</text>`;
    q.bubbles.forEach((b) => {
      const fs = b.l.length > 2 ? 12 : 16;
      s += `<circle cx="${b.x}" cy="${b.y}" r="18" fill="none" stroke="#000" stroke-width="2.5"/><text x="${b.x}" y="${b.y + fs / 2.6}" text-anchor="middle" font-size="${fs}" fill="#aaa">${esc(b.l)}</text>`;
    });
  });
  s += `<text x="500" y="1395" text-anchor="middle" font-size="14" fill="#888">${esc(tx.piedDePage)}</text></svg>`;
  return s;
}
