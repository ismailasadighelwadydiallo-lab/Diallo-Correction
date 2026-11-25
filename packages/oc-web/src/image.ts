// Photo → niveaux de gris → lecture de la feuille (oc-core), entièrement dans le navigateur.
import { readSheet, rgbaToGray, type ItemFeuille, type ResultatLecture } from 'oc-core';

const MAX_COTE = 1400;

export interface PhotoLue {
  lecture: ResultatLecture;
  canvas: HTMLCanvasElement;
  jpeg: Blob;
}

/** Décode une image. createImageBitmap si possible (rapide, tient compte de l'orientation EXIF),
 *  sinon <img> (anciens Safari, Firefox avec options non gérées). */
export async function chargerImage(f: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(f, { imageOrientation: 'from-image' }); } catch { /* repli */ }
  }
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Image illisible')); };
    img.src = url;
  });
}

export async function lirePhoto(f: Blob, items: ItemFeuille[]): Promise<PhotoLue> {
  const img = await chargerImage(f);
  const sc = Math.min(1, MAX_COTE / Math.max(img.width, img.height));
  const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, w, h);
  if ('close' in img) img.close();
  const g = rgbaToGray(x.getImageData(0, 0, w, h).data, w, h);
  const lecture = readSheet(g, w, h, items);
  const jpeg: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.7));
  return { lecture, canvas: c, jpeg };
}
