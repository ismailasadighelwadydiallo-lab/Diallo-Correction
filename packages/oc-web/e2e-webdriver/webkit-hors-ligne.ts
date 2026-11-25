// Test « mode avion » dans un vrai moteur WebKit (le moteur de Safari), piloté par WebDriver.
//
// Pourquoi ce test en plus de Playwright : Playwright a besoin de ses propres navigateurs
// Firefox et WebKit, qui ne sont pas toujours téléchargeables (réseau d'école, environnement
// isolé). WebKitGTK et son pilote WebDriver s'installent avec le gestionnaire de paquets de
// Linux (Ubuntu/Debian : `sudo apt install webkit2gtk-driver xvfb`).
//
// Le « mode avion » est réel : après la première visite, le serveur de l'application est ARRÊTÉ,
// puis la page est rechargée. Tout ce qui suit vient du service worker et d'IndexedDB.
//
// Lancement : npm run test:webkit   (build compris)
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const racine = resolve(import.meta.dirname, '../../..');
const web = resolve(racine, 'packages/oc-web');
const PORT_APP = 4180;
const PORT_WD = 4446;
const URL_APP = `http://localhost:${PORT_APP}`;
const MINIBROWSER = process.env.OC_MINIBROWSER
  ?? ['/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/MiniBrowser', '/usr/lib/aarch64-linux-gnu/webkit2gtk-4.1/MiniBrowser', '/usr/libexec/webkit2gtk-4.1/MiniBrowser']
    .find((p) => existsSync(p));

const PACK = resolve(racine, 'packs/demo-devoir-qcm.json');
const PACK_BAC = resolve(racine, 'packs/bac-2026-normale-maths-M-TMGM.json');
const FEUILLE1 = resolve(racine, 'fixtures/feuilles/eleve1-inclinee.png');
const FEUILLE2 = resolve(racine, 'fixtures/feuilles/eleve2-crayon-ombre.png');

const env = { ...process.env, NO_PROXY: 'localhost,127.0.0.1', no_proxy: 'localhost,127.0.0.1' };
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

function lancer(cmd: string, args: string[], cwd = racine): ChildProcess {
  const p = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  p.stdout?.on('data', () => {});
  p.stderr?.on('data', (d) => { if (process.env.OC_DEBUG) process.stderr.write(d); });
  return p;
}
function arreter(p: ChildProcess) { try { process.kill(-p.pid!, 'SIGTERM'); } catch { /* déjà arrêté */ } }

async function joignable(url: string) {
  try { await fetch(url); return true; } catch { return false; }
}
async function attendreUrl(url: string, ok = true, ms = 30_000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if ((await joignable(url)) === ok) return; await attendre(200); }
  throw new Error(`${url} ${ok ? 'ne répond pas' : 'répond encore'}`);
}

// --- Petit client WebDriver (W3C) ---
let session = '';
async function wd(methode: string, chemin: string, corps?: unknown) {
  const r = await fetch(`http://127.0.0.1:${PORT_WD}/session${session ? '/' + session : ''}${chemin}`, {
    method: methode, headers: { 'content-type': 'application/json' }, body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const j = await r.json() as { value: any };
  if (!r.ok) throw new Error(`WebDriver ${chemin} : ${JSON.stringify(j.value).slice(0, 300)}`);
  return j.value;
}
const ELT = 'element-6066-11e4-a52e-4f735466cecc';
const js = (script: string, ...args: unknown[]) => wd('POST', '/execute/sync', { script, args });
const jsAsync = (script: string, ...args: unknown[]) => wd('POST', '/execute/async', { script, args });
async function trouver(css: string) { const v = await wd('POST', '/element', { using: 'css selector', value: css }); return (v[ELT] ?? Object.values(v)[0]) as string; }
async function cliquer(css: string) { await attendreQue(`!!document.querySelector(${JSON.stringify(css)})`, `${css} présent`); await wd('POST', `/element/${await trouver(css)}/click`, {}); }
async function texte(css: string): Promise<string> { return js(`const e = document.querySelector(arguments[0]); return e ? e.textContent.trim() : null;`, css); }
async function attendreQue(expr: string, quoi: string, ms = 20_000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { if (await js(`return !!(${expr});`)) return; await attendre(150); }
  throw new Error(`Délai dépassé : ${quoi}`);
}
async function attendreTexte(css: string, attendu: string) {
  await attendreQue(`(document.querySelector(${JSON.stringify(css)})?.textContent ?? '').includes(${JSON.stringify(attendu)})`, `${css} contient « ${attendu} »`);
}
/** Le sélecteur de fichiers natif ne peut pas être piloté : on remplit l'<input type=file> créé par l'application. */
async function choisirFichiers(boutonCss: string, fichiers: string[]) {
  await js(`window.__ocErreurs ??= []; window.addEventListener('error', (e) => window.__ocErreurs.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => window.__ocErreurs.push(String(e.reason?.message ?? e.reason)));
    window.__ocClic ??= HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () { if (this.type !== 'file') return window.__ocClic.call(this); };`);
  await cliquer(boutonCss);
  await attendreQue(`document.querySelector('input[type=file]')`, 'champ fichier créé');
  const id = await trouver('input[type=file]');
  await wd('POST', `/element/${id}/value`, { text: fichiers.join('\n') });
}

const resultats: [string, boolean, string?][] = [];
async function etape(nom: string, f: () => Promise<void>) {
  try { await f(); resultats.push([nom, true]); console.log(`  ✓ ${nom}`); }
  catch (e) {
    const etat = await js(`return (document.querySelector('main')?.innerText ?? '').slice(0, 600) + ' | toast: ' + (document.querySelector('#toast')?.textContent ?? '') + ' | erreurs: ' + JSON.stringify(window.__ocErreurs ?? []);`).catch(() => '?');
    console.log(`      page : ${String(etat).replace(/\s+/g, ' ')}`);
    resultats.push([nom, false, String((e as Error).message)]); console.log(`  ✗ ${nom}\n      ${(e as Error).message}`); throw e; }
}

async function principal() {
  if (!MINIBROWSER) throw new Error('MiniBrowser (WebKitGTK) introuvable : sudo apt install webkit2gtk-driver');
  const serveurApp = () => lancer('npx', ['vite', 'preview', '--port', String(PORT_APP), '--strictPort'], web);
  let app = serveurApp();
  const pilote = lancer('xvfb-run', ['-a', 'WebKitWebDriver', `--port=${PORT_WD}`]);
  try {
    await attendreUrl(URL_APP);
    await attendreUrl(`http://127.0.0.1:${PORT_WD}/status`);
    const s = await wd('POST', '', { capabilities: { alwaysMatch: { 'webkitgtk:browserOptions': { binary: MINIBROWSER, args: ['--automation'] } } } });
    session = s.sessionId;
    const version = s.capabilities.browserVersion;
    console.log(`WebKitGTK ${version} (${s.capabilities.browserName})`);
    await wd('POST', '/timeouts', { script: 30_000 });

    await etape('première visite : le service worker installe l\'application', async () => {
      await wd('POST', '/url', { url: URL_APP + '/' });
      await jsAsync(`const fini = arguments[arguments.length - 1]; navigator.serviceWorker.ready.then(() => fini(true));`);
      await wd('POST', '/refresh', {});
      await attendreQue('navigator.serviceWorker.controller', 'page contrôlée par le service worker');
    });

    await etape('mode avion réel : serveur arrêté, l\'application se rouvre', async () => {
      arreter(app);
      await attendreUrl(URL_APP, false);
      await wd('POST', '/refresh', {});
      await attendreTexte('h2.accueil', 'Que voulez-vous faire ?');
      await attendreTexte('#statut', 'Hors ligne');
    });

    await etape('importer un pack (IndexedDB)', async () => {
      await cliquer('#go-epreuves');
      await choisirFichiers('#imp', [PACK]);
      await attendreTexte('main h2', 'Devoir de démonstration (QCM)');
    });

    await etape('corriger 2 photos : 16/20 et 15/20, double case signalée', async () => {
      await cliquer('#go-serie');
      await choisirFichiers('#gal', [FEUILLE1, FEUILLE2]);
      await attendreQue(`document.querySelectorAll('#liste .list-item').length === 2`, '2 copies corrigées', 30_000);
      const notes: string[] = await js(`return [...document.querySelectorAll('#liste .note')].map((e) => e.textContent.trim()).sort();`);
      if (notes.join() !== '15/20,16/20') throw new Error(`notes lues : ${notes.join(', ')}`);
      const signalees = await js(`return document.querySelectorAll('#liste .tag.warn').length;`);
      if (signalees !== 1) throw new Error(`${signalees} copie(s) signalée(s) au lieu de 1`);
    });

    await etape('copie corrigée : l\'enseignant modifie une note (17/20)', async () => {
      await js(`[...document.querySelectorAll('#liste .list-item')].find((e) => e.textContent.includes('16/20')).click();`);
      await attendreTexte('#note20', '16 / 20');
      await attendreQue(`document.querySelector('#vis') && document.querySelector('#vis').width > 0`, 'photo de la copie dessinée');
      await cliquer('[data-mod="Ex1-Q5"]');
      await js(`const s = document.querySelector('.qres[data-qid="Ex1-Q5"] select'); s.value = '1';
        document.querySelector('.qres[data-qid="Ex1-Q5"] .motif').value = 'case mal lue';`);
      await cliquer('.qres[data-qid="Ex1-Q5"] .ok');
      await attendreTexte('#note20', '17 / 20');
    });

    await etape('résultats de la classe et export CSV', async () => {
      await wd('POST', '/url', { url: URL_APP + '/#/resultats/demo-devoir-qcm' });
      await attendreTexte('#moyenne', '16');
      if ((await texte('#mediane')) !== '16') throw new Error('médiane fausse');
      // Le fichier CSV est intercepté au moment du téléchargement (pas de boîte de dialogue en test).
      await js(`window.__csv = null; const o = URL.createObjectURL;
        URL.createObjectURL = (b) => { b.text().then((t) => (window.__csv = t)); return o(b); };
        HTMLAnchorElement.prototype.click = function () {};`);
      await cliquer('#csv');
      await attendreQue(`window.__csv && window.__csv.includes('"17"')`, 'CSV contenant la note modifiée');
    });

    await etape('pack réel du Bac : import et feuille-réponse', async () => {
      await wd('POST', '/url', { url: URL_APP + '/#/epreuves' });
      await choisirFichiers('#imp', [PACK_BAC]);
      await attendreTexte('main h2', 'Mathématiques');
      await cliquer('a[href^="#/feuille/"]');
      await attendreQue(`document.querySelectorAll('main svg circle').length > 81`, 'feuille-réponse affichée');
    });

    await etape('interface en arabe (droite à gauche)', async () => {
      await wd('POST', '/url', { url: URL_APP + '/#/' });
      await cliquer('#lang');
      await attendreQue(`document.documentElement.dir === 'rtl'`, 'dir=rtl');
      await attendreTexte('h2.accueil', 'ماذا تريد أن تفعل؟');
      await cliquer('#lang');
    });

    await etape('aide à l\'installation affichée, puis fermée', async () => {
      await wd('POST', '/url', { url: URL_APP + '/#/' });
      await attendreQue(`document.querySelector('#installer')`, 'carte d\'installation');
      await cliquer('#inst-plus-tard');
      await attendreQue(`!document.querySelector('#installer')`, 'carte fermée');
    });

    await etape('labo IA hors ligne : sans WebGPU, repli sur wllama (processeur)', async () => {
      await wd('POST', '/url', { url: URL_APP + '/labo.html' });
      await attendreTexte('#appareil', 'WebGPU');
      const webgpu: boolean = await js(`return !!navigator.gpu;`);
      if (!webgpu) {
        await attendreQue(`document.querySelector('#modele').value.endsWith('-wllama')`, 'modèle wllama choisi d\'office');
        const grises: number = await js(`return [...document.querySelectorAll('#modele option')].filter((o) => o.disabled).length;`);
        if (grises !== 3) throw new Error(`${grises} modèles WebGPU grisés au lieu de 3`);
      }
      console.log(`      (WebGPU ${webgpu ? 'présent' : 'absent'} dans ce WebKit)`);
      // Sans réseau ni modèle en cache : message clair, pas de plantage.
      await cliquer('#charger');
      await attendreTexte('#ptexte', '❌');
    });

    await etape('sauvegarde complète puis restauration (photos comprises)', async () => {
      await wd('POST', '/url', { url: URL_APP + '/#/sauvegarde' });
      await js(`window.__csv = null; const o = URL.createObjectURL;
        URL.createObjectURL = (b) => { b.text().then((t) => (window.__csv = t)); return o(b); };
        HTMLAnchorElement.prototype.click = function () {};`);
      await cliquer('#exp');
      await attendreQue(`window.__csv && window.__csv.includes('data:image/jpeg;base64')`, 'sauvegarde avec les photos');
      // On vide la base, puis on restaure depuis le fichier.
      const fichier = resolve(process.env.TMPDIR ?? '/tmp', `oc-sauvegarde-webkit-${process.pid}.json`);
      const { writeFileSync, rmSync } = await import('node:fs');
      writeFileSync(fichier, await js('return window.__csv;'));
      await jsAsync(`const fini = arguments[arguments.length - 1];
        const r = indexedDB.open('offline-correction'); r.onsuccess = () => { const d = r.result;
          const t = d.transaction(['copies', 'packs'], 'readwrite'); t.objectStore('copies').clear(); t.objectStore('packs').clear();
          t.oncomplete = () => { d.close(); fini(true); }; };`);
      await wd('POST', '/refresh', {});
      await choisirFichiers('#imp', [fichier]);
      await attendreTexte('#toast', '2 copies');
      rmSync(fichier);
      await wd('POST', '/url', { url: URL_APP + '/#/resultats/demo-devoir-qcm' });
      await attendreTexte('#moyenne', '16');
    });

    await etape('photo d\'une copie restaurée affichée', async () => {
      await wd('POST', '/url', { url: URL_APP + '/#/corriger' });
      await wd('POST', '/url', { url: URL_APP + '/#/serie/demo-devoir-qcm' });
      await attendreQue(`document.querySelectorAll('#liste .list-item').length === 2`, '2 copies restaurées');
      await js(`document.querySelector('#liste .list-item').click();`);
      await attendreQue(`document.querySelector('#vis') && document.querySelector('#vis').width > 0`, 'photo dessinée');
    });
  } finally {
    if (session) await wd('DELETE', '').catch(() => {});
    arreter(pilote);
    arreter(app);
  }
}

const debut = Date.now();
principal().then(
  () => { console.log(`\nWebKit : ${resultats.length} étapes, toutes réussies (${((Date.now() - debut) / 1000).toFixed(1)} s)`); process.exit(0); },
  (e) => { console.error(`\nWebKit : ÉCHEC — ${(e as Error).message}`); process.exit(1); },
);
