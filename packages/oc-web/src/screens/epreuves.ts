import { lirePack, specFeuille, feuilleSVG, W, H, type Pack, type QuestionQcm } from 'oc-core';
import { db, uid } from '../db.ts';
import { t } from '../i18n.ts';
import { $, $$, app, choisirFichiers, esc, nomFichier, telecharger, titre, toast, pts } from '../ui.ts';

export function accueil() {
  titre('app', false);
  const carte = (href: string, icone: string, cle: 'corriger' | 'epreuves' | 'resultats' | 'sauvegarde' | 'labo', id: string) =>
    `<a class="card choix" href="${href}" id="${id}"><span class="ico">${icone}</span><span><b>${t(cle)}</b><br><span class="mut">${t((cle + '_d') as 'corriger_d')}</span></span></a>`;
  app().innerHTML = `<h2 class="accueil">${t('accueil_titre')}</h2>
    ${carte('#/corriger', '📷', 'corriger', 'go-corriger')}
    ${carte('#/epreuves', '📚', 'epreuves', 'go-epreuves')}
    ${carte('#/resultats', '📊', 'resultats', 'go-resultats')}
    ${carte('#/sauvegarde', '💾', 'sauvegarde', 'go-sauvegarde')}
    ${carte('./labo.html', '🧪', 'labo', 'go-labo')}
    <p class="mut centre">${t('donnees_locales')}</p>`;
}

/** Liste des épreuves ; `cible` = écran ouvert quand on touche une épreuve. */
export async function listeEpreuves(cible: 'epreuve' | 'serie' | 'resultats' = 'epreuve') {
  titre(cible === 'serie' ? 'choisir_epreuve' : cible === 'resultats' ? 'resultats' : 'epreuves');
  const packs = await db.packs.orderBy('ajoute_le').reverse().toArray();
  const nb = new Map<string, number>();
  for (const p of packs) nb.set(p.id, await db.copies.where('packId').equals(p.id).count());
  app().innerHTML = `<div class="card">
    ${packs.length ? packs.map((p) => `<a class="list-item" href="#/${cible}/${encodeURIComponent(p.id)}" data-pack="${esc(p.id)}">
      <div class="grow"><b>${esc(p.pack.titre)}</b><div class="mut">${p.pack.questions.length} ${t('questions')} · ${pts(p.pack.total)} · ${nb.get(p.id)} ${t('copies')}</div></div><span class="btn pri">${t('ouvrir')}</span></a>`).join('') : `<p class="mut">${t('aucune_epreuve')}</p>`}
    </div>
    ${cible === 'epreuve' || !packs.length ? `<div class="row"><button class="pri grow" id="imp">${t('importer_pack')}</button><a class="btn grow" href="#/creer">${t('creer_qcm')}</a></div>` : ''}`;
  $('#imp')?.addEventListener('click', importerPack);
}

export async function importerPack() {
  const [f] = await choisirFichiers('.json,application/json');
  if (!f) return;
  try {
    const pack = lirePack(await f.text());
    const existe = await db.packs.get(pack.id);
    await db.packs.put({ id: pack.id, pack, ajoute_le: new Date().toISOString(), origine: 'import' });
    toast(existe ? t('pack_existe') : `${t('pack_importe')} : ${pack.titre}`);
    location.hash = `#/epreuve/${encodeURIComponent(pack.id)}`;
  } catch (e) {
    alert((e as Error).message);
  }
}

export async function epreuve(id: string) {
  const p = await db.packs.get(id);
  if (!p) return (location.hash = '#/epreuves');
  const pack = p.pack;
  titre(pack.titre);
  const n = await db.copies.where('packId').equals(id).count();
  const relire = pack.meta?.a_relire?.length ?? 0;
  app().innerHTML = `<div class="card"><h2>${esc(pack.titre)}</h2>
    <div class="mut">${esc([pack.serie, pack.duree, pack.session].filter(Boolean).join(' · '))}</div>
    <div class="mut">${pack.questions.length} ${t('questions')} · ${pts(pack.total)} · ${n} ${t('copies')}</div>
    ${relire ? `<p class="tag warn">⚠️ ${relire} point(s) du corrigé à faire relire par un professeur</p>` : ''}
    <div class="row" style="margin-top:12px"><a class="btn pri grow" href="#/serie/${encodeURIComponent(id)}" id="go-serie">📷 ${t('serie')}</a></div>
    <div class="row"><a class="btn grow" href="#/resultats/${encodeURIComponent(id)}">📊 ${t('resultats')}</a><a class="btn grow" href="#/feuille/${encodeURIComponent(id)}">🖨️ ${t('feuille')}</a></div>
    <div class="row"><button class="grow" id="exp">⬇️ ${t('exporter_pack')}</button><button class="danger grow" id="del">${t('supprimer')}</button></div></div>
    <div class="card"><h3>${t('questions')}</h3>${pack.questions.map((q) => `<div class="q"><b class="qn">${esc(q.id)}</b><span class="grow">${esc(q.enonce || q.type)}</span><span class="tag">${pts(q.points)}</span>${q.type === 'qcm' ? `<span class="tag ok">${esc(q.bonnes.join(', '))}</span>` : ''}</div>`).join('')}</div>`;
  $('#exp').onclick = () => telecharger(`${nomFichier(pack.id)}.json`, JSON.stringify(pack, null, 2), 'application/json');
  $('#del').onclick = async () => {
    if (!confirm(t('confirmer_suppr'))) return;
    await db.copies.where('packId').equals(id).delete();
    await db.packs.delete(id);
    location.hash = '#/epreuves';
  };
}

export function creerQcm() {
  titre('creer_qcm');
  let n = 10, nc = 4, ptsQ = 1, titreE = '';
  const bonnes: string[][] = [];
  const lettres = 'ABCDEF';
  const render = () => {
    while (bonnes.length < n) bonnes.push([]);
    bonnes.length = n;
    const manque = bonnes.filter((b) => !b.length).length;
    app().innerHTML = `<div class="card">
      <label>${t('titre_epreuve')}</label><input id="t" value="${esc(titreE)}">
      <div class="row"><div class="grow"><label>${t('nb_questions')}</label><input id="n" type="number" min="1" max="40" value="${n}"></div>
      <div class="grow"><label>${t('nb_choix')}</label><select id="nc">${[2, 3, 4, 5, 6].map((k) => `<option ${k === nc ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="grow"><label>${t('pts_question')}</label><input id="p" type="number" step="0.25" min="0.25" value="${ptsQ}"></div></div></div>
      <div class="card"><h3>${t('bonnes_reponses')}</h3>
      ${bonnes.map((b, i) => `<div class="q"><span class="qn">${i + 1}</span>${lettres.slice(0, nc).split('').map((l) => `<button class="ch ${b.includes(l) ? 'good' : ''}" data-q="${i}" data-l="${l}">${l}</button>`).join('')}</div>`).join('')}
      ${manque ? `<p class="tag warn">${manque} ${t('manque_bonne')}</p>` : ''}
      <div class="row" style="margin-top:10px"><button class="pri grow" id="ok" ${manque ? 'disabled' : ''}>${t('creer')}</button></div></div>`;
    $('#t').oninput = (e) => (titreE = (e.target as HTMLInputElement).value);
    $('#n').onchange = (e) => { n = Math.max(1, Math.min(40, parseInt((e.target as HTMLInputElement).value) || 1)); render(); };
    $('#nc').onchange = (e) => { nc = +(e.target as HTMLSelectElement).value; bonnes.forEach((b, i) => (bonnes[i] = b.filter((l) => lettres.indexOf(l) < nc))); render(); };
    $('#p').onchange = (e) => { ptsQ = Math.max(0.25, Math.round((parseFloat((e.target as HTMLInputElement).value) || 1) * 4) / 4); render(); };
    $$('[data-q]').forEach((b) => (b.onclick = () => {
      const i = +b.dataset.q!, l = b.dataset.l!;
      bonnes[i] = bonnes[i].includes(l) ? bonnes[i].filter((x) => x !== l) : [...bonnes[i], l].sort();
      const y = scrollY; render(); scrollTo(0, y);
    }));
    $('#ok').onclick = async () => {
      const id = 'qcm-' + uid().slice(0, 8);
      const pack: Pack = {
        format: 'oc-pack/1', id, titre: titreE.trim() || 'QCM', total: n * ptsQ, langue: document.documentElement.lang === 'ar' ? 'ar' : 'fr',
        meta: { cree_le: new Date().toISOString(), source: 'créé dans Offline Correction' },
        questions: bonnes.map((b, i): QuestionQcm => ({ id: `Q${i + 1}`, exercice: 'QCM', type: 'qcm', enonce: '', points: ptsQ, choix: lettres.slice(0, nc).split(''), bonnes: b })),
      };
      await db.packs.put({ id, pack, ajoute_le: new Date().toISOString(), origine: 'cree' });
      location.hash = `#/epreuve/${id}`;
    };
  };
  render();
}

export async function feuille(id: string) {
  const p = await db.packs.get(id);
  if (!p) return (location.hash = '#/epreuves');
  titre('feuille');
  let svg: string;
  try {
    svg = feuilleSVG(specFeuille(p.pack), { titre: p.pack.titre, sousTitre: [p.pack.serie, p.pack.session].filter(Boolean).join(' · ') });
  } catch (e) {
    app().innerHTML = `<div class="card"><p class="tag bad">${esc((e as Error).message)}</p></div>`;
    return;
  }
  app().innerHTML = `<div class="card"><p class="mut">${t('feuille_aide')}</p>
    <div class="row"><button class="pri grow" id="pr">${t('imprimer')}</button><button class="grow" id="png">${t('telecharger_image')}</button></div></div>
    <div class="card" style="padding:6px">${svg.replace('<svg ', '<svg style="width:100%;height:auto" ')}</div>`;
  $('#pr').onclick = () => { $('#print').innerHTML = svg; window.print(); };
  $('#png').onclick = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W * 2; c.height = H * 2;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => b && telecharger(`feuille-${nomFichier(p.pack.titre)}.png`, b, 'image/png'));
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
}
