// Assistant du correcteur : Résoudre une épreuve (corrigé complet), Je bloque, Vérifier mon raisonnement.
// Tout est calculé sur l'appareil (oc-core) : aucun appel réseau.
import { corrigeComplet, ficheQuestion, resoudre, verifierRaisonnement, moteurMatiere, type FicheQuestion, type CorrigeComplet, type ContexteRaisonnement, type Pack, type Question, type SolutionCalculee } from 'oc-core';
import { db } from '../db.ts';
import { langue, nombre } from '../i18n.ts';
import { ta } from '../i18n-assistant.ts';
import { $, $$, app, esc, nomFichier, telecharger } from '../ui.ts';

const niv = (n: string) => ta((n === 'sans_objet' ? 'sans_objet' : n) as 'elevee');
const pt = (n: number) => `${nombre(n)} ${ta('points')}`;
const statutTag = (s: FicheQuestion['statut']) =>
  s === 'resolu' ? `<span class="tag ok">✓ ${ta('resolu')}</span>` : s === 'a_verifier' ? `<span class="tag warn">⚠️ ${ta('a_verifier')}</span>` : `<span class="tag bad">⚠️ ${ta('insuffisant')}</span>`;
const sourceBareme = (s: string) => (s === 'officiel' ? `<span class="tag ok">${ta('bareme_officiel')}</span>` : s === 'propose' ? `<span class="tag warn">${ta('bareme_propose')}</span>` : `<span class="tag warn">${ta('bareme_inconnu')}</span>`);

function titreEcran(texte: string) {
  $('#ttl').textContent = texte;
  $('#back').style.display = '';
}

// ---------------------------------------------------------------------------------------------
// Affichage d'une fiche (corrigé d'une question)

function blocConfiance(f: Pick<FicheQuestion, 'confiance' | 'raisons'>) {
  const c = f.confiance;
  return `<div class="conf"><b>${ta('confiance')}</b>
    <div class="row mut"><span>${ta('lecture')} : ${niv(c.lecture)}</span><span>${ta('comprehension')} : ${niv(c.comprehension)}</span><span>${ta('resolution')} : ${niv(c.resolution)}</span><span>${ta('notation')} : ${niv(c.notation)}</span></div>
    ${f.raisons.length ? `<div class="mut">${ta('pourquoi')} : ${f.raisons.map(esc).join(' · ')}</div>` : ''}</div>`;
}

function etapesHtml(etapes: { texte: string; calcul?: string }[], avecCalcul = true) {
  return `<ol class="etapes">${etapes.map((e) => `<li>${esc(e.texte)}${avecCalcul && e.calcul ? `<div class="calc">${esc(e.calcul)}</div>` : ''}</li>`).join('')}</ol>`;
}

export function solutionHtml(f: FicheQuestion) {
  const bloc = (titre: string, contenu: string) => `<div class="sol"><div class="soltit">${titre}</div>${contenu}</div>`;
  let h = '';
  if (f.comprendre) h += bloc(ta('comprendre'), `<p>${esc(f.comprendre)}</p>`);
  if (f.donnees.length) h += bloc(ta('donnees'), `<ul>${f.donnees.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`);
  if (f.methode) h += bloc(ta('methode'), `<p>${esc(f.methode)}</p>`);
  if (f.etapes.length) h += bloc(ta('developpement'), etapesHtml(f.etapes));
  if (f.resultat) h += bloc(ta('resultat'), `<p class="res">${esc(f.resultat)}</p>`);
  if (f.reponse) h += bloc(ta('reponse'), `<p>${esc(f.reponse)}</p>`);
  h += bloc(ta('verification'), f.controles.length ? `<ul class="verifs">${f.controles.map((c) => `<li>${c.ok ? '✅' : '❌'} ${esc(c.quoi)} <span class="mut">— ${esc(c.detail)}</span></li>`).join('')}</ul>` : `<p class="mut">${ta('pas_de_verif')}</p>`);
  h += bloc(`${ta('bareme')} ${sourceBareme(f.baremeSource)}`, `<table class="bareme">${f.bareme.map((b) => `<tr><td>${esc(b.critere)}</td><td>${pt(b.points)}</td></tr>`).join('')}<tr><th>Total</th><th>${pt(f.points)}</th></tr></table>`);
  h += blocConfiance(f);
  return h;
}

function methodeSeuleHtml(f: FicheQuestion) {
  if (f.methode || f.etapes.length) return `${f.methode ? `<p><b>${ta('methode')} :</b> ${esc(f.methode)}</p>` : ''}${f.etapes.length ? etapesHtml(f.etapes, false) : ''}`;
  return `<p class="mut">${ta('methode_non_redigee')}</p><ol class="etapes">${f.bareme.map((b) => `<li>${esc(b.critere)}</li>`).join('')}</ol>`;
}

/** Contexte pour « Vérifier mon raisonnement », déduit des vérifications de la question. */
function contexteDe(q: Question): ContexteRaisonnement {
  const v = q.verification ? (Array.isArray(q.verification) ? q.verification : [q.verification]) : [];
  const ctx: ContexteRaisonnement = {};
  for (const x of v) {
    const d = /^diff\((.+),\s*([a-z])\s*\)$/.exec(x.expression.trim());
    if (d && !ctx.fonction) { ctx.fonction = d[1]; ctx.variable = d[2]; if (x.egal_a) ctx.attendu = x.egal_a; }
    if (x.type === 'racines' && x.valeurs && !ctx.equation) { ctx.equation = `${x.expression} = 0`; ctx.attendu = x.valeurs.map(String); ctx.variable = x.variable ?? ctx.variable; }
  }
  return ctx;
}

/** Panneau « Je bloque » sous une question. */
function panneauBloque(racine: HTMLElement, f: FicheQuestion, q?: Question) {
  racine.innerHTML = `<div class="row bloque">
      <button data-a="sol">${ta('voir_solution')}</button>
      <button data-a="met">${ta('voir_methode')}</button>
      <button data-a="pas">${ta('pas_a_pas')}</button>
      <button data-a="alt">${ta('autre_methode')}</button>
      <button data-a="ver">${ta('verifier_mon')}</button>
    </div><div class="zone"></div>`;
  const zone = $('.zone', racine);
  $$('[data-a]', racine).forEach((b) => (b.onclick = () => {
    $$('[data-a]', racine).forEach((x) => x.classList.toggle('pri', x === b));
    const a = b.dataset.a;
    if (a === 'sol') zone.innerHTML = solutionHtml(f);
    else if (a === 'met') zone.innerHTML = methodeSeuleHtml(f);
    else if (a === 'alt') zone.innerHTML = f.alternatives.length
      ? f.alternatives.map((m) => `<div class="sol"><div class="soltit">${esc(m.nom)}</div>${m.methode ? `<p>${esc(m.methode)}</p>` : ''}${m.etapes ? etapesHtml(m.etapes) : ''}${m.resultat ? `<p class="res">${esc(m.resultat)}</p>` : ''}</div>`).join('')
      : `<p class="mut">${ta('aucune_autre')}</p>`;
    else if (a === 'pas') {
      const pas = f.etapes.length ? f.etapes : f.bareme.map((x) => ({ texte: x.critere }));
      let k = 0;
      const montrer = () => {
        zone.innerHTML = `<ol class="etapes">${pas.slice(0, k + 1).map((e) => `<li>${esc(e.texte)}${'calcul' in e && e.calcul ? `<div class="calc">${esc(e.calcul)}</div>` : ''}</li>`).join('')}</ol>
          ${k + 1 < pas.length ? `<button class="pri" id="suiv">${ta('etape_suivante')}</button>` : `<p class="mut">${ta('fin_etapes')}</p>${f.resultat ? `<p class="res">${ta('resultat')} : ${esc(f.resultat)}</p>` : ''}`}`;
        const s = zone.querySelector<HTMLButtonElement>('#suiv');
        if (s) s.onclick = () => { k++; montrer(); };
      };
      montrer();
    } else if (a === 'ver') formulaireRaisonnement(zone, q ? contexteDe(q) : {});
  }));
}

// ---------------------------------------------------------------------------------------------
// Résoudre une épreuve → liste des épreuves → corrigé complet

export async function resoudreAccueil() {
  titreEcran(ta('resoudre'));
  const packs = await db.packs.orderBy('ajoute_le').reverse().toArray();
  app().innerHTML = `<div class="card"><h3>${ta('nouvelle_epreuve')}</h3>
      <p class="hint">${ta('import_bientot')}</p>
      <div class="row"><a class="btn grow" href="#/epreuves">${ta('ouvrir_pack')}</a></div></div>
    <div class="card"><h3>${ta('corrige_complet')}</h3>
      ${packs.length ? packs.map((p) => `<a class="list-item" href="#/corrige/${encodeURIComponent(p.id)}" data-pack="${esc(p.id)}"><div class="grow"><b>${esc(p.pack.titre)}</b><div class="mut">${p.pack.questions.length} ${ta('questions_n').toLowerCase()} · ${pt(p.pack.total)}</div></div><span class="btn pri">${ta('resoudre_btn')}</span></a>`).join('') : `<p class="mut">${ta('aucun_pack')}</p>`}</div>
    ${carteQuestionLibre()}`;
  brancherQuestionLibre();
}

function exportHtml(c: CorrigeComplet) {
  const dir = langue() === 'ar' ? 'rtl' : 'ltr';
  const corps = c.fiches.map((f) => `<section><h3>${esc(f.exercice)} — ${esc(f.id)} (${pt(f.points)}) ${f.statut === 'resolu' ? '✓' : '⚠️'}</h3><p><i>${esc(f.enonce)}</i></p>${solutionHtml(f)}</section>`).join('');
  return `<!doctype html><html lang="${langue()}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(c.pack.titre)} — ${ta('corrige_complet')}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:auto;padding:16px;line-height:1.45}section{border-top:1px solid #ccc;padding-top:8px;margin-top:16px}.soltit{font-weight:700;margin-top:8px}.calc{font-family:monospace;background:#f3f5f7;padding:3px 6px;border-radius:4px}.res{font-weight:700}.mut{color:#666;font-size:13px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:3px 8px}.tag{font-size:12px;border:1px solid #ccc;border-radius:10px;padding:1px 6px}.row span{margin-inline-end:12px}</style></head>
<body><h1>${esc(c.pack.titre)}</h1><p>${ta('corrige_complet')} · ${sourceBareme(c.baremeSource)}</p>${c.avertissements.map((a) => `<p>⚠️ ${esc(a)}</p>`).join('')}
<p>${ta('questions_n')} : ${c.bilan.questions} · ${ta('resolues_n')} : ${c.bilan.resolues} · ${ta('a_verifier_n')} : ${c.bilan.aVerifier + c.bilan.insuffisantes}</p>${corps}
<p class="mut">Diallo-Correction — corrigé produit sur l'appareil, sans Internet.</p></body></html>`;
}

export async function corrige(id: string, filtre?: string) {
  const p = await db.packs.get(id);
  if (!p) return (location.hash = '#/resoudre');
  const pack = p.pack;
  titreEcran(ta('corrige_complet'));
  app().innerHTML = `<div class="card"><p class="mut">…</p></div>`;
  await new Promise((r) => setTimeout(r, 0));
  const c = corrigeComplet(pack);
  const seulement = filtre === 'a-verifier';
  const m = pack.matiere ? moteurMatiere(pack.matiere) : null;
  const fiches = seulement ? c.fiches.filter((f) => f.statut !== 'resolu') : c.fiches;
  app().innerHTML = `<div class="card"><h2>📖 ${esc(pack.titre)}</h2>
      <div class="mut">${esc([pack.examen, pack.serie, m ? m.nom[langue() === 'ar' ? 'ar' : 'fr'] : '', pack.annee, pack.session, pack.duree].filter(Boolean).join(' · '))}</div>
      <div class="row">${sourceBareme(c.baremeSource)}</div>
      ${c.avertissements.map((a) => `<p class="hint warn">⚠️ ${esc(a)}</p>`).join('')}
      <div class="row bilan" id="bilan"><div class="grow"><div class="mut">${ta('questions_n')}</div><div class="moyen">${c.bilan.questions}</div></div>
        <div class="grow"><div class="mut">${ta('resolues_n')}</div><div class="moyen" id="nb-resolues">${c.bilan.resolues}</div></div>
        <div class="grow"><div class="mut">${ta('a_verifier_n')}</div><div class="moyen" id="nb-a-verifier">${c.bilan.aVerifier + c.bilan.insuffisantes}</div></div></div>
      <div class="row"><a class="btn grow" id="filtre" href="#/corrige/${encodeURIComponent(id)}${seulement ? '' : '/a-verifier'}">${seulement ? ta('voir_tout') : ta('voir_a_verifier')}</a></div>
      <div class="row"><button class="grow" id="impr">${ta('imprimer_corrige')}</button><button class="grow" id="expc">${ta('exporter_corrige')}</button></div>
      <div class="row"><a class="btn pri grow" href="#/serie/${encodeURIComponent(id)}" id="utiliser">${ta('utiliser_corriger')}</a></div></div>
    <div class="card"><h3>${ta('bilan')}</h3>${c.exercices.map((e) => `<div class="q exo"><span class="grow">${esc(e.exercice)}</span><span class="tag">${pt(e.points)}</span>${e.statut === 'resolu' ? `<span class="tag ok">✓ ${ta('resolu')}</span>` : `<span class="tag warn">⚠️ ${e.aVerifier} ${ta('a_verifier_n').toLowerCase()}</span>`}</div>`).join('')}</div>
    ${fiches.map((f) => `<details class="card fiche" data-qid="${esc(f.id)}"><summary><b>${esc(f.exercice)} — ${esc(f.id)}</b> <span class="tag">${pt(f.points)}</span> ${statutTag(f.statut)}<div class="mut enonce">${esc(f.enonce)}</div></summary>
      <div class="corps"></div></details>`).join('')}`;
  $$<HTMLDetailsElement>('details.fiche').forEach((d) => (d.ontoggle = () => {
    const corps = $('.corps', d);
    if (!d.open || corps.childElementCount) return;
    const f = c.fiches.find((x) => x.id === d.dataset.qid)!;
    const q = pack.questions.find((x) => x.id === f.id);
    corps.innerHTML = `<div class="mut">${f.origine === 'solveur' ? ta('origine_solveur') : ta('origine_pack')}</div><div class="solution">${solutionHtml(f)}</div>
      <h4>🧠 ${ta('bloque')}</h4><div class="panneau"></div>`;
    panneauBloque($('.panneau', corps), f, q);
  }));
  $('#impr').onclick = () => { const pr = $('#print'); pr.className = 'texte'; pr.innerHTML = exportHtml(c).replace(/^[\s\S]*<body>|<\/body>[\s\S]*$/g, ''); window.print(); };
  $('#expc').onclick = () => telecharger(`corrige-${nomFichier(pack.titre)}.html`, exportHtml(c), 'text/html;charset=utf-8');
}

// ---------------------------------------------------------------------------------------------
// Je bloque : choisir une épreuve et une question, ou poser une question de maths

function carteQuestionLibre() {
  return `<div class="card"><h3>✏️ ${ta('question_libre')}</h3><p class="mut">${ta('question_libre_d')}</p>
    <textarea id="ql" rows="2" placeholder="Résous x^2 - 5x + 6 = 0"></textarea>
    <div class="row"><button class="pri grow" id="ql-ok">${ta('resoudre_btn')}</button></div><div id="ql-res"></div></div>`;
}

export function ficheDepuisSolveur(texte: string, s: SolutionCalculee): FicheQuestion {
  const statut: FicheQuestion['statut'] = s.confiance.niveau === 'aucune' ? 'insuffisant' : s.confiance.niveau === 'faible' ? 'a_verifier' : 'resolu';
  return {
    id: 'question', exercice: '', enonce: texte, points: 0, type: 'calcul', origine: s.confiance.niveau === 'aucune' ? 'aucune' : 'solveur',
    comprendre: s.comprendre, donnees: s.donnees, methode: s.methode, etapes: s.etapes, resultat: s.resultat, bareme: [], baremeSource: 'inconnu',
    controles: s.controles, alternatives: [], confiance: { lecture: 'sans_objet', comprehension: s.tache ? 'moyenne' : 'aucune', resolution: s.confiance.niveau, notation: 'aucune' },
    statut, raisons: s.confiance.raisons,
  };
}

function brancherQuestionLibre() {
  $('#ql-ok').onclick = () => {
    const texte = ($('#ql') as HTMLTextAreaElement).value.trim();
    if (!texte) return;
    const s = resoudre(texte);
    const f = ficheDepuisSolveur(texte, s);
    const h = solutionHtml(f).replace(/<div class="sol"><div class="soltit">[^<]*<span[^>]*>[^<]*<\/span><\/div><table[\s\S]*?<\/table><\/div>/, '');
    $('#ql-res').innerHTML = `<div class="row">${statutTag(f.statut)}</div>${h}`;
  };
}

export async function bloqueAccueil(packId?: string, qid?: string) {
  titreEcran(ta('bloque'));
  if (packId && qid) {
    const p = await db.packs.get(packId);
    const q = p?.pack.questions.find((x) => x.id === qid);
    if (!p || !q) return (location.hash = '#/bloque');
    const f = ficheQuestion(p.pack, q);
    app().innerHTML = `<div class="card"><b>${esc(f.exercice)} — ${esc(f.id)}</b> <span class="tag">${pt(f.points)}</span> ${statutTag(f.statut)}<p>${esc(f.enonce)}</p><div class="panneau"></div></div>`;
    panneauBloque($('.panneau'), f, q);
    return;
  }
  if (packId) {
    const p = await db.packs.get(packId);
    if (!p) return (location.hash = '#/bloque');
    app().innerHTML = `<div class="card"><h3>${ta('choisir_question')}</h3>${p.pack.questions.map((q) => `<a class="list-item" href="#/bloque/${encodeURIComponent(packId)}/${encodeURIComponent(q.id)}"><b class="qn">${esc(q.id)}</b><span class="grow">${esc(q.enonce || q.type)}</span><span class="tag">${pt(q.points)}</span></a>`).join('')}</div>`;
    return;
  }
  const packs = await db.packs.orderBy('ajoute_le').reverse().toArray();
  app().innerHTML = `${carteQuestionLibre()}
    <div class="card"><h3>📚 ${ta('choisir_question')}</h3>${packs.length ? packs.map((p) => `<a class="list-item" href="#/bloque/${encodeURIComponent(p.id)}"><div class="grow"><b>${esc(p.pack.titre)}</b></div><span class="btn">${p.pack.questions.length}</span></a>`).join('') : `<p class="mut">${ta('aucun_pack')}</p>`}</div>`;
  brancherQuestionLibre();
}

// ---------------------------------------------------------------------------------------------
// Vérifier mon raisonnement

function formulaireRaisonnement(zone: HTMLElement, ctx: ContexteRaisonnement) {
  const att = Array.isArray(ctx.attendu) ? ctx.attendu.join(' ; ') : ctx.attendu ?? '';
  zone.innerHTML = `<label>${ta('ma_demarche')}</label><textarea class="dem" rows="6" placeholder="${esc(ta('exemple_demarche'))}"></textarea>
    <details class="ctx" ${ctx.equation || ctx.fonction ? 'open' : ''}><summary class="mut">${ta('contexte')}</summary>
      <label>${ta('ctx_equation')}</label><input class="c-eq" value="${esc(ctx.equation ?? '')}" placeholder="x^2 - 5x + 6 = 0">
      <label>${ta('ctx_fonction')}</label><input class="c-f" value="${esc(ctx.fonction ?? '')}" placeholder="x*exp(2-x)">
      <label>${ta('ctx_attendu')}</label><input class="c-att" value="${esc(att)}" placeholder="2 ; 3"></details>
    <div class="row"><button class="pri grow v-ok">${ta('verifier_btn')}</button></div><div class="v-res"></div>`;
  $('.v-ok', zone).onclick = () => {
    const texte = ($('.dem', zone) as HTMLTextAreaElement).value;
    const eq = ($('.c-eq', zone) as HTMLInputElement).value.trim();
    const fn = ($('.c-f', zone) as HTMLInputElement).value.trim();
    const at = ($('.c-att', zone) as HTMLInputElement).value.trim();
    const c: ContexteRaisonnement = { variable: ctx.variable };
    if (eq) c.equation = eq;
    if (fn) c.fonction = fn.replace(/^\s*f\s*\(\s*x\s*\)\s*=\s*/, '');
    if (at) c.attendu = at.includes(';') || (eq && !fn) ? at.split(';').map((s) => s.trim()).filter(Boolean) : at;
    const r = verifierRaisonnement(texte, c);
    const etiq = { juste: ta('juste'), erreur: ta('erreur'), entrainee: ta('entrainee'), non_lue: ta('non_lue'), info: ta('info') };
    $('.v-res', zone).innerHTML = `<ol class="raisonnement">${r.lignes.map((l) => `<li class="l-${l.statut}"><code>${esc(l.texte)}</code><div><b>${etiq[l.statut]}</b> ${esc(l.message)}</div></li>`).join('')}</ol>
      <p class="hint ${r.resultatJuste === false || r.lignes.some((l) => l.statut === 'erreur') ? 'warn' : ''}" id="conclusion"><b>${ta('conclusion')} :</b> ${esc(r.conclusion)}</p>`;
  };
}

export function verifierAccueil() {
  titreEcran(ta('verifier'));
  app().innerHTML = `<div class="card"><p class="mut">${ta('verifier_d')}</p><div id="zone"></div></div>`;
  formulaireRaisonnement($('#zone'), {});
}

export type { Pack };
