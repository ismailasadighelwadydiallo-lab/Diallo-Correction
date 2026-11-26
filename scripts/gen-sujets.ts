// Sujets de test pour l'import (générés, pas de vrais sujets) :
//  - sujet-maths.pdf        : PDF avec texte intégré (comme un sujet tapé à l'ordinateur) ;
//  - sujet-maths.png        : image nette de la page (comme un scan) ;
//  - sujet-maths-photo.jpg  : même page, inclinée, ombrée, floue, bruitée (comme une photo au téléphone) ;
//  - sujet-maths-scan.pdf   : PDF sans texte, contenant seulement l'image (PDF scanné) ;
//  - sujet-arabe.png        : page en arabe.
// Lancer : node scripts/gen-sujets.ts (Chromium de Playwright).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const D = resolve(import.meta.dirname, '../fixtures/sujets');
const style = `body{font-family:'DejaVu Serif',serif;font-size:19px;line-height:1.5;margin:48px 56px;color:#111}h1{font-size:22px;text-align:center}h2{font-size:20px;margin:18px 0 6px}p{margin:4px 0}`;
export const SUJET_FR = `<h1>Baccalauréat 2026 — Mathématiques — Série SN</h1><p style="text-align:center">Durée : 4 heures</p>
<h2>Exercice 1 (4 points)</h2>
<p>1) Résoudre dans R l'équation x^2 - 5x + 6 = 0. (1 pt)</p>
<p>2) Développer (x + 1)^2. (1 pt)</p>
<p>3) Soit f la fonction définie par f(x) = x e^(2 - x).</p>
<p>a) Dériver f(x) = x e^(2 - x). (1 pt)</p>
<p>b) Calculer la limite de (x^2 - 1)/(x - 1) quand x tend vers 1. (1 pt)</p>
<h2>Exercice 2 (6 points)</h2>
<p>Une urne contient 3 boules rouges et 2 boules noires.</p>
<p>1) Calculer la probabilité de tirer une boule rouge. (2 pts)</p>
<p>2) On tire deux boules successivement sans remise. Calculer la probabilité de tirer deux boules rouges. (4 pts)</p>`;
const SUJET_AR = `<div dir="rtl" style="font-family:'Noto Naskh Arabic','DejaVu Sans',sans-serif"><h1>امتحان الباكالوريا 2026 — التربية الإسلامية</h1>
<h2>التمرين الأول (4 نقاط)</h2><p>1) عرف الصلاة لغة واصطلاحا. (2 ن)</p><p>2) اذكر أركان الإسلام. (2 ن)</p>
<h2>التمرين الثاني (6 نقاط)</h2><p>1) اشرح الحديث الشريف. (6 ن)</p></div>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
await p.setContent(`<style>${style}</style>${SUJET_FR}`);
await p.pdf({ path: `${D}/sujet-maths.pdf`, format: 'A4' });
await p.screenshot({ path: `${D}/sujet-maths.png` });
const png = readFileSync(`${D}/sujet-maths.png`).toString('base64');
// « Photo » : inclinaison 2,5°, ombre en dégradé, léger flou, bruit, compression JPEG.
await p.setContent(`<body style="margin:0;background:#8a8a80"><canvas id=c width=1588 height=2246></canvas></body>`);
const jpg = await p.evaluate(async (src) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
  const c = document.getElementById('c') as HTMLCanvasElement; const x = c.getContext('2d')!;
  x.fillStyle = '#8a8a80'; x.fillRect(0, 0, c.width, c.height);
  x.translate(c.width / 2, c.height / 2); x.rotate(2.5 * Math.PI / 180); x.scale(0.94, 0.94); x.filter = 'blur(1.2px)';
  x.drawImage(img, -img.width / 2, -img.height / 2); x.setTransform(1, 0, 0, 1, 0, 0); x.filter = 'none';
  const g = x.createLinearGradient(0, 0, c.width, c.height); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height); let s = 7;
  for (let i = 0; i < d.data.length; i += 4) { s = (s * 16807) % 2147483647; const n = ((s / 2147483647) - 0.5) * 30; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
  x.putImageData(d, 0, 0);
  return c.toDataURL('image/jpeg', 0.8).split(',')[1];
}, png);
writeFileSync(`${D}/sujet-maths-photo.jpg`, Buffer.from(jpg, 'base64'));
await p.setContent(`<style>@page{margin:0}body{margin:0}</style><img src="data:image/png;base64,${png}" style="width:210mm;height:297mm;display:block">`);
await p.pdf({ path: `${D}/sujet-maths-scan.pdf`, format: 'A4', printBackground: true });
await p.setContent(`<style>${style}</style>${SUJET_AR}`);
await p.screenshot({ path: `${D}/sujet-arabe.png` });
await b.close();
console.log('sujets générés dans fixtures/sujets/');
