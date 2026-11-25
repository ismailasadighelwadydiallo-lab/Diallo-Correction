import { copieDepuisLecture, modifierNote, noterCopie, specFeuille, type ItemFeuille, type Pack } from 'oc-core';
import { db, uid, type CopieEnregistree } from '../db.ts';
import { lirePhoto } from '../image.ts';
import { t, nombre } from '../i18n.ts';
import { $, $$, app, choisirFichiers, esc, pts, titre } from '../ui.ts';

const badge = (c: CopieEnregistree) =>
  `${c.resultat.douteuse && !c.resultat.modifications.length ? `<span class="tag warn">⚠️ ${t('a_revoir')}</span>` : ''}${c.resultat.modifications.length ? `<span class="tag">✎ ${t('modifiee')}</span>` : ''}`;

function ligneCopie(c: CopieEnregistree) {
  return `<a class="list-item" href="#/copie/${c.id}" data-copie="${c.id}"><div class="grow"><b>${esc(c.eleve)}</b> ${badge(c)}</div>
    <span class="note">${nombre(c.resultat.sur20)}/20</span></a>`;
}

export async function serie(packId: string) {
  const p = await db.packs.get(packId);
  if (!p) return (location.hash = '#/corriger');
  const pack = p.pack;
  titre('serie');
  let items: ItemFeuille[];
  try {
    items = specFeuille(pack);
  } catch (e) {
    app().innerHTML = `<div class="card"><p class="tag bad">${esc((e as Error).message)}</p></div>`;
    return;
  }
  const copies = await db.copies.where('packId').equals(packId).reverse().sortBy('date');
  app().innerHTML = `<div class="card"><h2>${esc(pack.titre)}</h2><p class="mut">${t('serie_aide')}</p>
    <div class="row"><button class="pri grow" id="cam">${t('photographier')}</button></div>
    <div class="row"><button class="grow" id="gal">${t('galerie')}</button></div>
    <div id="encours"></div></div>
    <div class="card"><h3>${t('copies_corrigees')} (<span id="nb">${copies.length}</span>)</h3><div id="liste">${copies.length ? copies.map(ligneCopie).join('') : `<p class="mut" id="vide">${t('aucune_copie')}</p>`}</div></div>`;
  const traiter = async (fichiers: File[]) => {
    for (const f of fichiers) {
      const enc = $('#encours');
      enc.innerHTML = `<p class="mut" id="lecture">⏳ ${t('lecture_en_cours')} ${esc(f.name)}</p>`;
      try {
        const n = (await db.copies.where('packId').equals(packId).count()) + 1;
        const c = await corrigerPhoto(pack, items, f, `${t('copie_n')} ${n}`);
        enc.innerHTML = '';
        if (!c) {
          enc.innerHTML = `<div class="hint" id="echec"><b>${t('copie_non_reconnue')} (${esc(f.name)})</b><br>${t('conseils')}</div>`;
          continue;
        }
        $('#vide')?.remove();
        $('#liste').insertAdjacentHTML('afterbegin', ligneCopie(c));
        $('#nb').textContent = String(n);
      } catch (e) {
        enc.innerHTML = `<div class="hint">${esc((e as Error).message)}</div>`;
      }
    }
  };
  $('#cam').onclick = async () => traiter(await choisirFichiers('image/*', { capture: true }));
  $('#gal').onclick = async () => traiter(await choisirFichiers('image/*', { multiple: true }));
}

/** Lit, note et enregistre une copie. Renvoie null si la feuille n'est pas reconnue. */
export async function corrigerPhoto(pack: Pack, items: ItemFeuille[], f: Blob, eleve: string): Promise<CopieEnregistree | null> {
  const { lecture, jpeg } = await lirePhoto(f, items);
  if (!lecture.ok) return null;
  const copie = copieDepuisLecture(items, lecture.lignes, eleve);
  const resultat = noterCopie(pack, copie);
  const c: CopieEnregistree = {
    id: uid(), packId: pack.id, eleve, copie, resultat, image: jpeg,
    positions: lecture.lignes.map((l) => l.positions), reperes: lecture.reperes, rayon: lecture.rayon, date: new Date().toISOString(),
  };
  await db.copies.put(c);
  return c;
}

export async function copie(id: string) {
  const c = await db.copies.get(id);
  if (!c) return (location.hash = '#/');
  const p = await db.packs.get(c.packId);
  if (!p) return (location.hash = '#/');
  const pack = p.pack;
  titre('copie');
  const r = c.resultat;
  const pc = (x: number) => `${Math.round(x * 100)} %`;
  app().innerHTML = `
    ${c.image ? `<div class="card" style="padding:8px"><canvas id="vis"></canvas><div class="mut" style="padding:6px 4px">🟢 juste · 🔴 faux · vert pâle = réponse attendue</div></div>` : ''}
    <div class="card">
      <label>${t('eleve')}</label><input id="nm" value="${esc(c.eleve)}">
      <div class="row" style="margin-top:12px"><div class="grow"><div class="big" id="note20">${nombre(r.sur20)} / 20</div><div class="mut">${pts(r.note)} / ${pts(r.total)}</div></div>
      <div><div class="mut">${t('confiance_lecture')} : <b>${pc(r.confiance.lecture)}</b></div><div class="mut">${t('confiance_notation')} : <b>${pc(r.confiance.notation)}</b></div></div></div>
      ${r.douteuse ? `<div class="hint warn"><b>⚠️ ${t('doute_raisons')} :</b><br>${r.raisons_doute.map(esc).join('<br>')}</div>` : ''}
    </div>
    <div class="card">${r.questions.map((q) => `<div class="qres" data-qid="${esc(q.id)}">
      <div class="row"><b class="grow">${esc(q.id)}</b>${q.modifiee ? `<span class="tag">✎ ${t('modifiee')}</span>` : ''}<span class="tag ${q.points >= q.max ? 'ok' : q.points > 0 ? 'warn' : 'bad'}">${nombre(q.points)} / ${pts(q.max)}</span><button class="petit" data-mod="${esc(q.id)}">${t('modifier')}</button></div>
      ${q.etapes.length > 1 ? `<ul class="etapes">${q.etapes.map((e) => `<li>${esc(e.critere)} : ${nombre(e.points)}/${nombre(e.max)}</li>`).join('')}</ul>` : ''}
      ${q.explications.map((e) => `<div class="mut expl">${esc(e)}</div>`).join('')}
      <div class="mod" hidden></div></div>`).join('')}</div>
    ${r.modifications.length ? `<div class="card"><h3>${t('journal')}</h3>${r.modifications.map((m) => `<div class="mut">${new Date(m.date).toLocaleString()} — ${esc(m.question)} : ${nombre(m.ancien)} → ${nombre(m.nouveau)} ${m.motif ? '(' + esc(m.motif) + ')' : ''}</div>`).join('')}</div>` : ''}
    <div class="row"><button class="danger grow" id="del">${t('supprimer')}</button></div>`;
  $('#nm').onchange = async (e) => {
    c.eleve = (e.target as HTMLInputElement).value.trim() || c.eleve;
    await db.copies.update(c.id, { eleve: c.eleve, copie: { ...c.copie, eleve: c.eleve } });
  };
  $('#del').onclick = async () => {
    if (!confirm(t('supprimer') + ' ?')) return;
    await db.copies.delete(c.id);
    history.back();
  };
  $$('[data-mod]').forEach((b) => (b.onclick = () => {
    const qid = b.dataset.mod!;
    const q = pack.questions.find((x) => x.id === qid)!;
    const box = $('.mod', b.closest('.qres')!);
    const cur = r.questions.find((x) => x.id === qid)!.points;
    const vals: number[] = [];
    for (let v = 0; v <= q.points + 1e-9; v += 0.25) vals.push(Math.round(v * 100) / 100);
    box.hidden = false;
    box.innerHTML = `<div class="row"><select class="nv">${vals.map((v) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${nombre(v)}</option>`).join('')}</select>
      <input class="motif grow" placeholder="${t('motif')}"><button class="pri ok">${t('enregistrer')}</button></div>`;
    $('.ok', box).onclick = async () => {
      const nv = +($('.nv', box) as HTMLSelectElement).value;
      const motif = ($('.motif', box) as HTMLInputElement).value.trim() || undefined;
      const res = modifierNote(pack, c.copie, c.resultat, qid, nv, motif);
      await db.copies.update(c.id, { resultat: res });
      copie(id);
    };
  }));
  if (c.image) dessiner(c, pack);
}

async function dessiner(c: CopieEnregistree, pack: Pack) {
  const bmp = await createImageBitmap(c.image!);
  const v = $<HTMLCanvasElement>('#vis');
  if (!v) return;
  v.width = bmp.width; v.height = bmp.height;
  const x = v.getContext('2d')!;
  x.drawImage(bmp, 0, 0);
  const rad = c.rayon ?? 10;
  x.lineWidth = Math.max(2, rad / 5);
  c.reperes?.forEach(([u, w]) => { x.strokeStyle = '#0b5cad'; x.strokeRect(u - rad * 1.6, w - rad * 1.6, rad * 3.2, rad * 3.2); });
  const items = specFeuille(pack);
  items.forEach((it, i) => {
    const q = pack.questions[i];
    const rep = c.copie.reponses[it.id];
    const choisis = rep && 'choix' in rep ? rep.choix : [];
    const ptsLus = rep && 'points' in rep ? rep.points : null;
    it.labels.forEach((l, k) => {
      const pos = c.positions?.[i]?.[k];
      if (!pos) return;
      let col: string | null = null;
      if (q.type === 'qcm') {
        const bonne = q.bonnes.includes(l);
        if (choisis.includes(l)) col = bonne ? '#1a8a4a' : '#c4372c';
        else if (bonne) col = 'rgba(26,138,74,.45)';
      } else if (ptsLus !== null && it.valeurs![k] === ptsLus) col = '#0b5cad';
      if (col) { x.strokeStyle = col; x.beginPath(); x.arc(pos[0], pos[1], rad * 1.25, 0, 7); x.stroke(); }
    });
  });
}
