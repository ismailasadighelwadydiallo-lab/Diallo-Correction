import { exporterCsv, statistiques } from 'oc-core';
import { db, exporterTout, importerTout } from '../db.ts';
import { t, nombre } from '../i18n.ts';
import { $, app, choisirFichiers, esc, nomFichier, telecharger, titre, toast } from '../ui.ts';

const barre = (p: number) => `<div class="bar grow"><i style="width:${Math.round(p * 100)}%;background:${p < 0.4 ? 'var(--bad)' : p < 0.7 ? 'var(--warn)' : 'var(--ok)'}"></i></div><span class="pc">${Math.round(p * 100)} %</span>`;

export async function resultats(packId: string) {
  const p = await db.packs.get(packId);
  if (!p) return (location.hash = '#/resultats');
  const pack = p.pack;
  titre('resultats');
  const copies = (await db.copies.where('packId').equals(packId).toArray()).sort((a, b) => a.eleve.localeCompare(b.eleve));
  const s = statistiques(pack, copies.map((c) => c.resultat));
  app().innerHTML = `<div class="card"><h2>${esc(pack.titre)}</h2>
    <div class="row stats">
      <div class="grow"><div class="mut">${t('moyenne')}</div><div class="big" id="moyenne">${nombre(s.moyenne)}</div></div>
      <div class="grow"><div class="mut">${t('mediane')}</div><div class="big" id="mediane">${nombre(s.mediane)}</div></div>
      <div class="grow"><div class="mut">${t('min_max')}</div><div class="moyen">${s.n ? nombre(s.min) + ' / ' + nombre(s.max) : '–'}</div></div>
      <div class="grow"><div class="mut">${t('copies')}</div><div class="moyen">${s.n}${s.douteuses ? ` <span class="tag warn">⚠️ ${s.douteuses}</span>` : ''}</div></div>
    </div>
    <div class="row" style="margin-top:10px"><button class="grow" id="csv" ${s.n ? '' : 'disabled'}>${t('export_csv')}</button></div></div>
    ${s.n ? `<div class="card"><h3>${t('reussite_exercice')}</h3>${s.parExercice.map((e) => `<div class="row barre"><span class="qn">${esc(e.exercice)}</span>${barre(e.reussite)}</div>`).join('')}</div>
    <div class="card"><h3>${t('copies_corrigees')}</h3><table><tr><th>${t('eleve')}</th><th>/20</th><th></th></tr>
      ${copies.map((c) => `<tr><td><a href="#/copie/${c.id}">${esc(c.eleve)}</a></td><td><b>${nombre(c.resultat.sur20)}</b></td><td>${c.resultat.douteuse && !c.resultat.modifications.length ? '⚠️' : ''}${c.resultat.modifications.length ? '✎' : ''}</td></tr>`).join('')}</table></div>
    <div class="card"><h3>${t('reussite_question')}</h3>${s.parQuestion.map((e) => `<div class="row barre"><span class="qn">${esc(e.question)}</span>${barre(e.reussite)}</div>`).join('')}</div>`
    : `<div class="card"><p class="mut">${t('aucune_copie')}</p></div>`}`;
  $('#csv').onclick = () => telecharger(`${nomFichier(pack.titre)}-notes.csv`, exporterCsv(pack, copies.map((c) => ({ eleve: c.eleve, resultat: c.resultat }))), 'text/csv;charset=utf-8');
}

export function sauvegarde() {
  titre('sauvegarde');
  app().innerHTML = `<div class="card"><p class="mut">${t('sauvegarde_d')} ${t('donnees_locales')}</p>
    <div class="row"><button class="pri grow" id="exp">${t('exporter_tout')}</button></div>
    <div class="row"><button class="grow" id="imp">${t('importer_tout')}</button></div></div>`;
  $('#exp').onclick = async () => telecharger(`offline-correction-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, await exporterTout(), 'application/json');
  $('#imp').onclick = async () => {
    const [f] = await choisirFichiers('.json,application/json');
    if (!f) return;
    try {
      const r = await importerTout(await f.text());
      toast(`${t('import_ok')} ${r.packs} ${t('epreuves').toLowerCase()}, ${r.copies} ${t('copies')}.`);
    } catch {
      alert(t('fichier_invalide'));
    }
  };
}
