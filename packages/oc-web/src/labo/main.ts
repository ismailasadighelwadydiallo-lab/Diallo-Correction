// Page labo (phase 0) : mesurer ce que l'IA locale donne sur CE téléphone.
import '../style.css';
import './labo.css';
import { CANDIDATS, chargerWebLLM, chargerWllama, type Moteur, type Source } from './moteurs.ts';
import { QUESTIONS, SYSTEME } from './questions.ts';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const mo = (b?: number) => (b === undefined ? '?' : `${Math.round(b / 1e6)} Mo`);

interface Appareil {
  userAgent: string;
  webgpu: boolean;
  gpu?: string;
  gpuMaxBuffer?: number;
  memoireGo?: number;
  coeurs?: number;
  stockageQuota?: number;
  stockageUtilise?: number;
  stockagePersistant?: boolean;
  crossOriginIsolated: boolean;
  enLigne: boolean;
}

interface MesureQuestion { id: string; langue: string; tokens: number; mots: number; ms: number; msPremierToken: number; tokParS: number; motsParS: number; plausible: boolean; reponse: string }

const rapport: {
  date: string;
  appareil?: Appareil;
  modele?: { id: string; nom: string; moteur: string; source: Source; licence: string };
  chargement?: { ms: number; stockageAvant?: number; stockageApres?: number; telechargeEstime?: number; depuisCache: boolean; enLigne: boolean };
  questions: MesureQuestion[];
  resume?: { motsParS: number; tokParS: number; plausibles: string };
  erreurs: string[];
} = { date: new Date().toISOString(), questions: [], erreurs: [] };

async function detecter(): Promise<Appareil> {
  const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ info?: { vendor?: string; architecture?: string; description?: string }; limits: { maxBufferSize: number } } | null> }; deviceMemory?: number };
  const a: Appareil = { userAgent: navigator.userAgent, webgpu: false, crossOriginIsolated: self.crossOriginIsolated, enLigne: navigator.onLine, coeurs: navigator.hardwareConcurrency, memoireGo: nav.deviceMemory };
  try {
    const ad = await nav.gpu?.requestAdapter();
    if (ad) {
      a.webgpu = true;
      a.gpu = [ad.info?.vendor, ad.info?.architecture, ad.info?.description].filter(Boolean).join(' ') || 'inconnu';
      a.gpuMaxBuffer = ad.limits.maxBufferSize;
    }
  } catch (e) { rapport.erreurs.push('WebGPU : ' + (e as Error).message); }
  try {
    const est = await navigator.storage?.estimate();
    a.stockageQuota = est?.quota;
    a.stockageUtilise = est?.usage;
    a.stockagePersistant = await navigator.storage?.persisted?.();
  } catch { /* indisponible */ }
  return a;
}

function afficherAppareil(a: Appareil) {
  $('#appareil').innerHTML = `<table>
    <tr><td>WebGPU</td><td><b>${a.webgpu ? '✅ oui' : '❌ non'}</b> ${esc(a.gpu ?? '')}</td></tr>
    <tr><td>Mémoire (approx., plafonnée à 8 Go par Chrome)</td><td>${a.memoireGo ?? '?'} Go</td></tr>
    <tr><td>Cœurs processeur</td><td>${a.coeurs ?? '?'}</td></tr>
    <tr><td>Stockage disponible</td><td>${mo(a.stockageQuota)} (utilisé ${mo(a.stockageUtilise)}) ${a.stockagePersistant ? '· persistant' : ''}</td></tr>
    <tr><td>Réseau</td><td>${a.enLigne ? '🌐 en ligne' : '✈️ hors ligne'}</td></tr></table>
    ${!a.webgpu ? '<p class="hint">Pas de WebGPU : choisissez un modèle « sans WebGPU » (wllama). Ce sera plus lent.</p>' : ''}`;
}

let moteur: Moteur | null = null;

async function charger() {
  const c = CANDIDATS.find((x) => x.id === ($('#modele') as HTMLSelectElement).value)!;
  const source = ($('#source') as HTMLSelectElement).value as Source;
  const btn = $('#charger') as HTMLButtonElement;
  btn.disabled = true;
  $('#progres').hidden = false;
  if (moteur) { await moteur.decharger().catch(() => {}); moteur = null; }
  const avant = (await navigator.storage?.estimate?.())?.usage;
  const t0 = performance.now();
  const prog = (f: number, t: string) => { ($('#barre') as HTMLProgressElement).value = f; $('#ptexte').textContent = t; };
  try {
    const fichier = ($('#gguf') as HTMLInputElement).files?.[0];
    moteur = c.moteur === 'webllm' ? await chargerWebLLM(c, source, prog, SYSTEME) : await chargerWllama(c, source, prog, SYSTEME, fichier);
    const ms = performance.now() - t0;
    const apres = (await navigator.storage?.estimate?.())?.usage;
    const telecharge = avant !== undefined && apres !== undefined ? Math.max(0, apres - avant) : undefined;
    rapport.modele = { id: c.ref, nom: c.nom, moteur: c.moteur, source, licence: c.licence };
    rapport.chargement = { ms: Math.round(ms), stockageAvant: avant, stockageApres: apres, telechargeEstime: telecharge, depuisCache: (telecharge ?? 0) < 5e6, enLigne: navigator.onLine };
    $('#ptexte').textContent = `✅ Chargé en ${(ms / 1000).toFixed(1)} s. ${telecharge !== undefined ? `Téléchargé (différence de stockage) : ${mo(telecharge)}.` : ''} ${(telecharge ?? 0) < 5e6 ? 'Modèle lu depuis le stockage du téléphone.' : ''}`;
    ($('#tester') as HTMLButtonElement).disabled = false;
  } catch (e) {
    const m = (e as Error).message;
    rapport.erreurs.push('Chargement : ' + m);
    $('#ptexte').textContent = '❌ ' + m + (navigator.onLine ? '' : ' (hors ligne : le modèle doit avoir été téléchargé une première fois)');
  }
  btn.disabled = false;
  majRapport();
}

async function tester() {
  if (!moteur) return;
  const btn = $('#tester') as HTMLButtonElement;
  btn.disabled = true;
  rapport.questions = [];
  const zone = $('#reponses');
  zone.innerHTML = '';
  for (const q of QUESTIONS) {
    const div = document.createElement('div');
    div.className = 'card';
    div.dir = q.langue === 'ar' ? 'rtl' : 'ltr';
    div.innerHTML = `<b>${esc(q.texte)}</b><div class="mut">Attendu : ${esc(q.attendu)}</div><pre class="rep"></pre><div class="mes mut"></div>`;
    zone.appendChild(div);
    const rep = div.querySelector('.rep')!;
    try {
      const g = await moteur.generer(q.texte, (t) => (rep.textContent = t));
      const mots = g.texte.split(/\s+/).filter(Boolean).length;
      const s = g.ms / 1000;
      const m: MesureQuestion = { id: q.id, langue: q.langue, tokens: g.tokens, mots, ms: Math.round(g.ms), msPremierToken: Math.round(g.msPremierToken), tokParS: +(g.tokens / s).toFixed(2), motsParS: +(mots / s).toFixed(2), plausible: q.verif(g.texte), reponse: g.texte };
      rapport.questions.push(m);
      div.querySelector('.mes')!.textContent = `${m.plausible ? '✅ plausible' : '⚠️ à vérifier'} · ${m.motsParS} mots/s · ${m.tokParS} tokens/s · 1er mot après ${(m.msPremierToken / 1000).toFixed(1)} s · ${(m.ms / 1000).toFixed(1)} s au total`;
    } catch (e) {
      rapport.erreurs.push(`${q.id} : ${(e as Error).message}`);
      rep.textContent = '❌ ' + (e as Error).message;
    }
    majRapport();
  }
  const Q = rapport.questions;
  if (Q.length) {
    const tot = (k: 'mots' | 'tokens') => Q.reduce((a, x) => a + x[k], 0);
    const sec = Q.reduce((a, x) => a + x.ms, 0) / 1000;
    rapport.resume = { motsParS: +(tot('mots') / sec).toFixed(2), tokParS: +(tot('tokens') / sec).toFixed(2), plausibles: `${Q.filter((x) => x.plausible).length}/${Q.length}` };
  }
  majRapport();
  btn.disabled = false;
}

function texteRapport(): string {
  const r = rapport;
  const l: string[] = ['=== Offline Correction — rapport labo IA locale ===', `Date : ${r.date}`];
  if (r.appareil) {
    const a = r.appareil;
    l.push(`Appareil : ${a.userAgent}`, `WebGPU : ${a.webgpu ? 'oui (' + (a.gpu ?? '') + ')' : 'non'} · mémoire ≈ ${a.memoireGo ?? '?'} Go · cœurs ${a.coeurs ?? '?'} · stockage dispo ${mo(a.stockageQuota)} · isolé ${a.crossOriginIsolated}`);
  }
  if (r.modele) l.push(`Modèle : ${r.modele.nom} [${r.modele.id}] · moteur ${r.modele.moteur} · source ${r.modele.source} · licence ${r.modele.licence}`);
  if (r.chargement) l.push(`Chargement : ${(r.chargement.ms / 1000).toFixed(1)} s · téléchargé ≈ ${mo(r.chargement.telechargeEstime)} · ${r.chargement.depuisCache ? 'depuis le stockage local' : 'téléchargé'} · ${r.chargement.enLigne ? 'en ligne' : 'MODE AVION'}`);
  if (r.resume) l.push(`Résumé : ${r.resume.motsParS} mots/s · ${r.resume.tokParS} tokens/s · réponses plausibles ${r.resume.plausibles}`);
  for (const q of r.questions) l.push(`- ${q.id} : ${q.plausible ? 'OK' : '??'} · ${q.motsParS} mots/s · ${q.tokParS} tok/s · 1er ${q.msPremierToken} ms · total ${q.ms} ms\n  « ${q.reponse.replace(/\s+/g, ' ').slice(0, 300)} »`);
  if (r.erreurs.length) l.push('Erreurs :', ...r.erreurs.map((e) => '- ' + e));
  l.push('', 'JSON :', JSON.stringify({ ...r, questions: r.questions.map(({ reponse, ...x }) => ({ ...x, reponse: reponse.slice(0, 500) })) }));
  return l.join('\n');
}

function majRapport() { ($('#rapport') as HTMLTextAreaElement).value = texteRapport(); }

/** Navigateur sans WebGPU (Firefox Android/Linux, anciens Safari, Chrome ancien…) :
 *  les modèles WebLLM sont grisés et un modèle wllama (processeur) est choisi d'office. */
function adapterSansWebGPU() {
  const sel = $('#modele') as HTMLSelectElement;
  for (const o of sel.options) {
    const c = CANDIDATS.find((x) => x.id === o.value)!;
    if (c.moteur === 'webllm') { o.disabled = true; o.textContent = `${c.nom} — WebGPU absent sur ce navigateur`; }
  }
  const premier = CANDIDATS.find((c) => c.moteur === 'wllama');
  if (premier && CANDIDATS.find((c) => c.id === sel.value)?.moteur === 'webllm') { sel.value = premier.id; sel.dispatchEvent(new Event('change')); }
}

function init() {
  $('#app').innerHTML = `
  <div class="card"><h2>1. Ce téléphone</h2><div id="appareil">Détection…</div></div>
  <div class="card"><h2>2. Modèle</h2>
    <label>Modèle candidat</label><select id="modele">${CANDIDATS.map((c) => `<option value="${c.id}">${esc(c.nom)} — ${c.licence}</option>`).join('')}</select>
    <p class="mut" id="note"></p>
    <label>Source (une seule fois ; ensuite le modèle est gardé sur le téléphone)</label>
    <select id="source"><option value="internet">🌐 Internet — Hugging Face (Internet requis la 1re fois)</option><option value="serveur">🟣 Serveur local de l'école (/modeles/)</option><option value="fichier">📁 Fichier .gguf sur le téléphone (wllama)</option></select>
    <input type="file" id="gguf" accept=".gguf" hidden>
    <div class="row"><button class="pri grow" id="charger">Charger le modèle</button></div>
    <div id="progres" hidden><progress id="barre" max="1" value="0"></progress><div class="mut" id="ptexte"></div></div></div>
  <div class="card"><h2>3. Les 10 questions de test</h2><p class="mut">Français et arabe, dont « Résous x² − 5x + 6 = 0 ». Vous pouvez passer en mode avion avant de charger le modèle (s'il a déjà été téléchargé).</p>
    <div class="row"><button class="pri grow" id="tester" disabled>Lancer les tests</button></div></div>
  <div id="reponses"></div>
  <div class="card"><h2>4. Rapport</h2><p class="mut">Copiez ce texte et envoyez-le (WhatsApp, e-mail…).</p>
    <textarea id="rapport" readonly rows="10"></textarea>
    <div class="row"><button class="grow" id="copier">📋 Copier</button><button class="grow" id="dl">⬇️ Télécharger</button></div></div>`;
  const note = () => {
    const c = CANDIDATS.find((x) => x.id === ($('#modele') as HTMLSelectElement).value)!;
    $('#note').textContent = `${c.moteur === 'webllm' ? 'WebLLM (WebGPU)' : 'wllama (processeur, sans WebGPU)'} · ${c.note}`;
    ($('#source').querySelector('[value=fichier]') as HTMLOptionElement).disabled = c.moteur !== 'wllama';
  };
  $('#modele').onchange = note;
  $('#source').onchange = () => { $('#gguf').hidden = ($('#source') as HTMLSelectElement).value !== 'fichier'; };
  note();
  $('#charger').onclick = charger;
  $('#tester').onclick = tester;
  $('#copier').onclick = async () => { const t = texteRapport(); try { await navigator.clipboard.writeText(t); $('#copier').textContent = '✅ Copié'; } catch { ($('#rapport') as HTMLTextAreaElement).select(); document.execCommand('copy'); } };
  $('#dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texteRapport()], { type: 'text/plain' })); a.download = `rapport-labo-${new Date().toISOString().slice(0, 16).replace(/:/g, '')}.txt`; a.click(); };
  detecter().then((a) => {
    rapport.appareil = a; afficherAppareil(a); majRapport();
    if (!a.webgpu) adapterSansWebGPU();
  });
  // garder le modèle même si le téléphone manque de place
  navigator.storage?.persist?.().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  addEventListener('online', () => rapport.appareil && afficherAppareil({ ...rapport.appareil, enLigne: true }));
  addEventListener('offline', () => rapport.appareil && afficherAppareil({ ...rapport.appareil, enLigne: false }));
}
init();
