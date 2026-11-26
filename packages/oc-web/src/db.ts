// Stockage local (IndexedDB via Dexie). Rien ne quitte l'appareil.
import Dexie, { type EntityTable } from 'dexie';
import type { Copie, Pack, Resultat } from 'oc-core';

export interface PackEnregistre {
  id: string;
  pack: Pack;
  ajoute_le: string;
  origine: 'import' | 'cree' | 'serveur' | 'sujet';
}

export interface CopieEnregistree {
  id: string;
  packId: string;
  eleve: string;
  copie: Copie;
  resultat: Resultat;
  /** Photo réduite (JPEG) pour l'affichage de la copie corrigée.
   *  Enregistrée en ArrayBuffer : Safari/WebKit refuse parfois les Blob dans IndexedDB
   *  (« Error preparing Blob/File data to be stored in object store »). */
  image?: ArrayBuffer | Blob;
  /** Positions des cases dans l'image (pour dessiner les cercles). */
  positions?: [number, number][][];
  reperes?: [number, number][];
  rayon?: number;
  date: string;
}

export const db = new Dexie('offline-correction') as Dexie & {
  packs: EntityTable<PackEnregistre, 'id'>;
  copies: EntityTable<CopieEnregistree, 'id'>;
};
db.version(1).stores({ packs: 'id, ajoute_le', copies: 'id, packId, date' });

/** Photo d'une copie sous forme de Blob, qu'elle soit enregistrée en ArrayBuffer ou (anciennes copies) en Blob. */
export const imageBlob = (c: Pick<CopieEnregistree, 'image'>) =>
  c.image instanceof Blob ? c.image : c.image ? new Blob([c.image], { type: 'image/jpeg' }) : undefined;

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

/** Sauvegarde complète dans un objet JSON (images en base64). */
export async function exporterTout(): Promise<string> {
  const packs = await db.packs.toArray();
  const copies = await db.copies.toArray();
  const c2 = await Promise.all(copies.map(async (c) => ({ ...c, image: c.image ? await blobVersBase64(imageBlob(c)!) : undefined })));
  return JSON.stringify({ format: 'oc-sauvegarde/1', date: new Date().toISOString(), packs, copies: c2 });
}

export async function importerTout(texte: string): Promise<{ packs: number; copies: number }> {
  const d = JSON.parse(texte);
  if (d.format !== 'oc-sauvegarde/1' || !Array.isArray(d.packs) || !Array.isArray(d.copies)) throw new Error('format');
  const copies = await Promise.all(d.copies.map(async (c: CopieEnregistree & { image?: string }) => ({ ...c, image: c.image ? await (await base64VersBlob(c.image)).arrayBuffer() : undefined })));
  await db.transaction('rw', db.packs, db.copies, async () => {
    await db.packs.bulkPut(d.packs);
    await db.copies.bulkPut(copies as CopieEnregistree[]);
  });
  return { packs: d.packs.length, copies: copies.length };
}

function blobVersBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(b);
  });
}
async function base64VersBlob(s: string): Promise<Blob> {
  // décodage local (pas de fetch, même sur une data: URL)
  const [tete, donnees] = s.split(',');
  const type = /data:([^;]+)/.exec(tete)?.[1] ?? 'application/octet-stream';
  const bin = atob(donnees);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type });
}
