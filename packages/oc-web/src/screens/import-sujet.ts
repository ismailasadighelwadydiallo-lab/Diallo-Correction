// Importer un sujet : photo, scan ou PDF → texte lu sur l'appareil → découpage vérifié par
// l'enseignant → pack enregistré → corrigé complet. Aucun envoi sur Internet.
import { decouperSujet, sujetVersPack, validerPack, type SujetDecoupe } from 'oc-core';
import { db, uid } from '../db.ts';
import { ta } from '../i18n-assistant.ts';
import { lireImages, lirePdf, ocrPret, preparerOcr, type Langues, type TexteLu } from '../lecture-sujet.ts';
import { $, $$, app, choisirFichiers, esc, toast } from '../ui.ts';
import { langue } from '../i18n.ts';

let dernierTexte: TexteLu | null = null;

function titreEcran() {
  $('#ttl').textContent = ta('imp_titre');
  $('#back').style.display = '';
}

const langueChoisie = () => ($('#imp-langue') as HTMLSelectElement).value as Langues;

async function etatOcr() {
  const z = $('#ocr-etat');
  if (!z) return;
  const pret = await ocrPret(langueChoisie());
  z.innerHTML = pret ? `<p class="mut">${ta('ocr_pret')}</p>`
    : navigator.onLine ? `<p class="hint">${ta('ocr_a_preparer')}</p><div class="row"><button class="grow" id="prep-ocr">${ta('ocr_preparer')}</button></div>`
    : `<p class="hint warn">${ta('ocr_hors_ligne')}</p>`;
  const b = z.querySelector<HTMLButtonElement>('#prep-ocr');
  if (b) b.onclick = () => lancer(async (p) => { await preparerOcr(langueChoisie(), p); await etatOcr(); return null; });
}

function progres(message: string, fraction?: number) {
  const z = $('#imp-progres');
  z.innerHTML = `<p class="mut">${esc(message)}</p>${fraction !== undefined ? `<progress max="1" value="${Math.max(0, Math.min(1, fraction))}"></progress>` : ''}`;
}

async function lancer(f: (p: typeof progres) => Promise<TexteLu | null>) {
  $$<HTMLButtonElement>('#imp-boutons button, #prep-ocr').forEach((b) => (b.disabled = true));
  try {
    const r = await f(progres);
    $('#imp-progres').innerHTML = '';
    if (r) { dernierTexte = r; afficherTexte(r); }
  } catch (e) {
    console.error(e);
    $('#imp-progres').innerHTML = `<p class="hint warn">⚠️ ${esc((e as Error)?.message ?? e)}</p>`;
  } finally {
    $$<HTMLButtonElement>('#imp-boutons button, #prep-ocr').forEach((b) => (b.disabled = false));
  }
}

export async function importerSujet() {
  titreEcran();
  dernierTexte = null;
  app().innerHTML = `<div class="card"><h3>${ta('imp_titre')}</h3><p class="mut">${ta('imp_d')}</p>
      <label>${ta('imp_langue')}</label>
      <select id="imp-langue"><option value="fra">${ta('imp_fr')}</option><option value="ara">${ta('imp_ar')}</option><option value="fra+ara">${ta('imp_frar')}</option></select>
      <div id="imp-boutons">
        <div class="row"><button class="pri grow" id="imp-photo">${ta('imp_photo')}</button></div>
        <div class="row"><button class="grow" id="imp-images">${ta('imp_images')}</button></div>
        <div class="row"><button class="grow" id="imp-pdf">${ta('imp_pdf')}</button></div>
      </div>
      <div id="ocr-etat"></div><div id="imp-progres"></div></div>
    <div id="imp-texte"></div><div id="imp-decoupage"></div>`;
  ($('#imp-langue') as HTMLSelectElement).value = langue() === 'ar' ? 'ara' : 'fra';
  $('#imp-langue').onchange = () => etatOcr();
  const images = async (capture: boolean) => {
    const fs = await choisirFichiers('image/*', { multiple: !capture, capture });
    if (fs.length) lancer((p) => lireImages(fs, langueChoisie(), p));
  };
  $('#imp-photo').onclick = () => images(true);
  $('#imp-images').onclick = () => images(false);
  $('#imp-pdf').onclick = async () => {
    const [f] = await choisirFichiers('application/pdf,.pdf');
    if (f) lancer((p) => lirePdf(f, langueChoisie(), p));
  };
  await etatOcr();
}

function afficherTexte(r: TexteLu) {
  const vide = !r.texte.trim();
  $('#imp-texte').innerHTML = `<div class="card"><h3>${ta('texte_lu')}</h3>
    <p class="${r.source === 'pdf_texte' ? 'mut' : 'hint warn'}" id="lu-source">${r.source === 'pdf_texte' ? ta('lu_pdf_texte') : ta('lu_ocr')}
      ${r.confiance !== undefined ? `<br>${ta('confiance_ocr')} : <b id="lu-confiance">${Math.round(r.confiance)}/100</b>` : ''}</p>
    ${r.source !== 'pdf_texte' ? `<p class="mut">${ta('formules_ocr')}</p>` : ''}
    ${vide ? `<p class="hint warn">${ta('texte_vide')}</p>` : ''}
    <textarea id="texte-lu" rows="14" dir="auto">${esc(r.texte)}</textarea>
    <div class="row"><button class="pri grow" id="decouper">${ta('decouper')}</button></div></div>`;
  $('#imp-decoupage').innerHTML = '';
  $('#decouper').onclick = () => afficherDecoupage(decouperSujet(($('#texte-lu') as HTMLTextAreaElement).value));
}

function afficherDecoupage(s: SujetDecoupe) {
  const z = $('#imp-decoupage');
  z.innerHTML = `<div class="card"><h3>${ta('verifier_decoupage')}</h3>
    ${s.avertissements.map((a) => `<p class="hint warn">⚠️ ${esc(a)}</p>`).join('')}
    <label>${ta('titre_epreuve')}</label><input id="dec-titre" value="${esc(s.titre)}" dir="auto">
    <div id="dec-ex">${s.exercices.map((e, i) => `<div class="exo-dec" data-ex="${i}">
      <div class="row"><input class="grow ex-titre" value="${esc(e.titre)}" dir="auto"><input class="ex-pts pts-in" type="number" step="0.25" min="0" value="${e.points ?? ''}" placeholder="${ta('points_inconnus')}"></div>
      ${e.introduction ? `<p class="mut ex-intro" dir="auto">${esc(e.introduction)}</p>` : ''}
      ${(e.questions.length ? e.questions : [{ id: '1', enonce: e.introduction || e.titre, points: e.points, contexte: undefined }]).map((q) => `<div class="q-dec" data-id="${esc(q.id)}" data-contexte="${esc(q.contexte ?? '')}">
        <div class="row"><b class="qn">${esc(q.id)}</b><input class="q-pts pts-in" type="number" step="0.25" min="0" value="${q.points ?? ''}" placeholder="${ta('points_inconnus')}"><button class="q-sup" title="${ta('supprimer')}">✕</button></div>
        <textarea class="q-enonce" rows="2" dir="auto">${esc(q.enonce)}</textarea></div>`).join('')}
    </div>`).join('')}</div>
    <div class="row"><button class="pri grow" id="enregistrer">${ta('enregistrer_resoudre')}</button></div><div id="dec-err"></div></div>`;
  $$('.q-sup', z).forEach((b) => (b.onclick = () => b.closest('.q-dec')!.remove()));
  $('#enregistrer').onclick = () => enregistrer();
  z.scrollIntoView({ behavior: 'smooth' });
}

/** Lit le découpage tel que l'enseignant l'a corrigé. */
function lireFormulaire(): SujetDecoupe {
  const nombre = (el: Element) => { const v = (el as HTMLInputElement).value.trim().replace(',', '.'); return v === '' ? null : Number(v) > 0 ? Number(v) : null; };
  return {
    titre: ($('#dec-titre') as HTMLInputElement).value.trim() || 'Sujet importé',
    entete: [],
    avertissements: [],
    exercices: $$('.exo-dec').map((e) => ({
      titre: ($('.ex-titre', e) as HTMLInputElement).value.trim() || 'Exercice',
      points: nombre($('.ex-pts', e)),
      introduction: $('.ex-intro', e)?.textContent ?? '',
      questions: $$('.q-dec', e).map((q) => ({
        id: q.dataset.id!, enonce: ($('.q-enonce', q) as HTMLTextAreaElement).value.trim(), points: nombre($('.q-pts', q)), contexte: q.dataset.contexte || undefined,
      })).filter((q) => q.enonce),
    })).filter((e) => e.questions.length),
  };
}

async function enregistrer() {
  const s = lireFormulaire();
  if (!s.exercices.length) { $('#dec-err').innerHTML = `<p class="hint warn">${ta('texte_vide')}</p>`; return; }
  const r = dernierTexte;
  const pack = sujetVersPack(s, {
    id: `sujet-${uid()}`,
    langue: langueChoisie() === 'ara' ? 'ar' : 'fr',
    cree_le: new Date().toISOString(),
    lecture: r ? { source: r.source, pages: r.pages, ...(r.confiance !== undefined ? { confiance: Math.round(r.confiance) } : {}) } : undefined,
  });
  const v = validerPack(pack);
  if (!v.ok) { $('#dec-err').innerHTML = `<p class="hint warn">${v.erreurs.map(esc).join('<br>')}</p>`; return; }
  await db.packs.put({ id: pack.id, pack, ajoute_le: new Date().toISOString(), origine: 'sujet' });
  toast(`✓ ${pack.titre}`);
  location.hash = `#/corrige/${encodeURIComponent(pack.id)}`;
}
