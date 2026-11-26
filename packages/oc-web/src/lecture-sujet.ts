// Lecture du texte d'un sujet : PDF (texte intégré, ou pages scannées) et photos (OCR).
// Tout se passe dans le navigateur. Les fichiers de lecture (moteur Tesseract, langues
// française et arabe, décodeurs pdf.js) sont servis par l'application dans ./ocr/,
// jamais par un CDN, puis gardés par le service worker pour le mode avion.
import { corrigerFormulesOcr } from 'oc-core';
import { chargerImage } from './image.ts';

const BASE = import.meta.env.BASE_URL;
export const DOSSIER_OCR = `${BASE}ocr/`;

export type Langues = 'fra' | 'ara' | 'fra+ara';
export interface TexteLu {
  texte: string;
  source: 'pdf_texte' | 'pdf_image' | 'photo';
  /** Confiance moyenne de l'OCR (0-100) ; absente pour un PDF à texte intégré. */
  confiance?: number;
  pages: number;
}
export type Progres = (message: string, fraction?: number) => void;

/** Plus grand côté d'une page envoyée à l'OCR (au-delà : plus lent, pas plus juste). */
const MAX_COTE_OCR = 2400;

type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;

async function moteurOcr(langues: Langues, progres: Progres): Promise<TesseractWorker> {
  const T = await import('tesseract.js');
  progres('Préparation de la lecture…', 0);
  return T.createWorker(langues.split('+'), T.OEM.LSTM_ONLY, {
    workerPath: `${DOSSIER_OCR}worker.min.js`,
    corePath: DOSSIER_OCR,
    langPath: DOSSIER_OCR.replace(/\/$/, ''),
    gzip: true,
    workerBlobURL: false,
    // Les fichiers sont gardés par le service worker (cache « oc-ocr ») : pas de 2e copie.
    cacheMethod: 'none',
    logger: (m: { status: string; progress: number }) => {
      if (/recognizing/.test(m.status)) progres('Lecture du texte…', m.progress);
      else if (/load|initializ/.test(m.status)) progres('Chargement du moteur de lecture…', m.progress);
    },
  });
}

async function versCanvas(src: Blob): Promise<HTMLCanvasElement> {
  const img = await chargerImage(src);
  const sc = Math.min(1, MAX_COTE_OCR / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(img, 0, 0, c.width, c.height);
  if ('close' in img) img.close();
  return c;
}

async function ocrCanvases(pages: HTMLCanvasElement[], langues: Langues, progres: Progres): Promise<{ texte: string; confiance: number }> {
  const w = await moteurOcr(langues, progres);
  try {
    const textes: string[] = [];
    let somme = 0;
    for (let i = 0; i < pages.length; i++) {
      progres(`Lecture de la page ${i + 1} sur ${pages.length}…`, i / pages.length);
      const { data } = await w.recognize(pages[i]);
      textes.push(data.text);
      somme += data.confidence;
    }
    return { texte: corrigerFormulesOcr(textes.join('\n')), confiance: pages.length ? somme / pages.length : 0 };
  } finally {
    await w.terminate();
  }
}

/** Photos ou scans d'un sujet (une image par page). */
export async function lireImages(fichiers: Blob[], langues: Langues, progres: Progres): Promise<TexteLu> {
  const pages: HTMLCanvasElement[] = [];
  for (const f of fichiers) pages.push(await versCanvas(f));
  const r = await ocrCanvases(pages, langues, progres);
  return { texte: r.texte, source: 'photo', confiance: r.confiance, pages: pages.length };
}

/** Une ligne de texte d'un PDF, reconstruite à partir des morceaux positionnés. */
interface Morceau { str: string; x: number; y: number; h: number; w: number; rtl: boolean }
function lignesDePage(items: Morceau[]): string[] {
  const tri = items.filter((m) => m.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lignes: Morceau[][] = [];
  for (const m of tri) {
    const l = lignes[lignes.length - 1];
    if (l && Math.abs(l[0].y - m.y) <= Math.max(2, 0.4 * Math.max(l[0].h, m.h))) l.push(m);
    else lignes.push([m]);
  }
  return lignes.map((l) => {
    const rtl = l.filter((m) => m.rtl).length > l.length / 2;
    l.sort((a, b) => (rtl ? b.x - a.x : a.x - b.x));
    // Deux morceaux qui se touchent (ex. ligature « fi ») sont collés, sinon séparés par une espace.
    let txt = '';
    l.forEach((m, i) => {
      const prec = l[i - 1];
      const ecart = prec ? (rtl ? prec.x - (m.x + m.w) : m.x - (prec.x + prec.w)) : 0;
      txt += (prec && ecart > 0.12 * Math.max(m.h, prec.h) ? ' ' : '') + m.str;
    });
    return txt.normalize('NFKC').replace(/\s+/g, ' ').trim();
  });
}

/** PDF : texte intégré si présent ; sinon (PDF scanné) chaque page est lue par OCR. */
export async function lirePdf(f: Blob, langues: Langues, progres: Progres): Promise<TexteLu> {
  progres('Ouverture du PDF…', 0);
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), wasmUrl: DOSSIER_OCR, isEvalSupported: false }).promise;
  try {
    const textes: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const morceaux: Morceau[] = [];
      for (const it of tc.items) {
        if (!('str' in it)) continue;
        morceaux.push({ str: it.str, x: it.transform[4], y: it.transform[5], h: Math.abs(it.transform[3]) || it.height, w: it.width, rtl: it.dir === 'rtl' });
      }
      textes.push(lignesDePage(morceaux).join('\n'));
      progres(`Page ${i} sur ${doc.numPages}…`, i / doc.numPages);
    }
    const lettres = textes.join('').replace(/\s/g, '').length;
    if (lettres >= 40 * doc.numPages) return { texte: textes.join('\n'), source: 'pdf_texte', pages: doc.numPages };

    // Pas (ou presque pas) de texte : PDF scanné → image de chaque page → OCR.
    const pages: HTMLCanvasElement[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      progres(`Préparation de la page ${i} sur ${doc.numPages}…`, i / doc.numPages);
      const page = await doc.getPage(i);
      const v1 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(4, MAX_COTE_OCR / Math.max(v1.width, v1.height)) });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await page.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp, background: '#ffffff' }).promise;
      pages.push(c);
    }
    const r = await ocrCanvases(pages, langues, progres);
    return { texte: r.texte, source: 'pdf_image', confiance: r.confiance, pages: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

/** Les fichiers de lecture des photos sont-ils gardés sur l'appareil (mode avion possible) ? */
export async function ocrPret(langues: Langues): Promise<boolean> {
  if (!('caches' in window)) return false;
  try {
    const c = await caches.open('oc-ocr');
    const cles = (await c.keys()).map((r) => new URL(r.url).pathname.split('/').pop());
    return cles.includes('worker.min.js') && cles.some((k) => /^tesseract-core.*\.wasm\.js$/.test(k ?? ''))
      && langues.split('+').every((l) => cles.includes(`${l}.traineddata.gz`));
  } catch { return false; }
}

/** Télécharge une fois les fichiers de lecture (en lisant une petite image), pour le mode avion. */
export async function preparerOcr(langues: Langues, progres: Progres): Promise<void> {
  const c = document.createElement('canvas');
  c.width = 200; c.height = 60;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff'; x.fillRect(0, 0, 200, 60); x.fillStyle = '#000'; x.font = '28px sans-serif'; x.fillText('Test 12', 10, 40);
  await ocrCanvases([c], langues, progres);
}
