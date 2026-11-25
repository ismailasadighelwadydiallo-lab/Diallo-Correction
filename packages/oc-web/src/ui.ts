import { t, nombre, type Cle } from './i18n.ts';

export const $ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector(s) as T;
export const $$ = <T extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll(s)] as T[];
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const app = () => $('#app');
export const pts = (n: number) => `${nombre(n)} ${t('pts')}`;

export function titre(cle: Cle | string, retour = true) {
  $('#ttl').textContent = (t as (k: string) => string)(cle) ?? cle;
  $('#back').style.display = retour ? '' : 'none';
}

export function telecharger(nom: string, data: BlobPart, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** Ouvre le sélecteur de fichiers et renvoie les fichiers choisis. */
export function choisirFichiers(accept: string, opts: { multiple?: boolean; capture?: boolean } = {}): Promise<File[]> {
  return new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.multiple = !!opts.multiple;
    if (opts.capture) i.setAttribute('capture', 'environment');
    i.style.display = 'none';
    i.onchange = () => { res([...(i.files ?? [])]); i.remove(); };
    document.body.appendChild(i);
    i.click();
  });
}

let toastTimer = 0;
export function toast(msg: string, ms = 3500) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), ms);
}

export const nomFichier = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w؀-ۿ-]+/g, '-').replace(/^-|-$/g, '') || 'epreuve';
