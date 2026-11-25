// Aide à l'installation de la PWA, quel que soit le navigateur.
// - Chrome, Edge, Samsung Internet, Opera : vrai bouton « Installer » (événement beforeinstallprompt).
// - Safari (iPhone, iPad, Mac), Firefox : pas de bouton possible → explication du geste à faire.
// L'application fonctionne hors ligne même sans installation ; l'installation sert surtout
// à garder les données (Safari efface le stockage des sites non installés après 7 jours sans visite).
import { t, type Cle } from './i18n.ts';

interface InvitationInstall extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

let invitation: InvitationInstall | null = null;
let stockagePersistant: boolean | undefined;

export function initInstallation(rafraichir: () => void) {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); invitation = e as InvitationInstall; rafraichir(); });
  addEventListener('appinstalled', () => { invitation = null; rafraichir(); });
  // Demande au navigateur de ne pas effacer les données (copies, packs) en cas de manque d'espace.
  const st = navigator.storage;
  if (st?.persist) {
    st.persist().then((ok) => { stockagePersistant = ok; rafraichir(); }).catch(() => {});
  }
}

export function estInstallee() {
  return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Quel conseil donner sur ce navigateur ? (détection par l'agent utilisateur : uniquement pour le texte d'aide) */
export function conseilInstallation(ua = navigator.userAgent, tactile = navigator.maxTouchPoints > 1): Cle | null {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && tactile);
  if (ios) return 'inst_ios';
  if (/Firefox\//.test(ua)) return /Android/.test(ua) ? 'inst_firefox_android' : 'inst_firefox_pc';
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua)) return 'inst_mac';
  return 'inst_autre';
}

const FERME = 'oc-install-ferme';
const ferme = () => { try { return localStorage.getItem(FERME) === '1'; } catch { return false; } };

/** Carte affichée sur l'accueil (vide si l'application est déjà installée ou si l'aide a été fermée). */
export function carteInstallation(): string {
  const avertStockage = stockagePersistant === false && !estInstallee()
    ? `<p class="mut" id="stockage-fragile">${t('stockage_fragile')}</p>` : '';
  if (estInstallee() || ferme()) return avertStockage;
  const conseil = invitation ? null : conseilInstallation();
  return `<div class="card" id="installer">
    <b>${t('inst_titre')}</b>
    ${conseil ? `<p class="mut" id="inst-conseil">${t(conseil)}</p>` : ''}
    <div class="row">${invitation ? `<button class="pri grow" id="inst-ok">${t('inst_bouton')}</button>` : ''}
    <button class="grow" id="inst-plus-tard">${t('inst_fermer')}</button></div></div>${avertStockage}`;
}

export function brancherCarteInstallation(rafraichir: () => void) {
  const ok = document.getElementById('inst-ok');
  if (ok) ok.onclick = async () => { await invitation?.prompt(); invitation = null; rafraichir(); };
  const non = document.getElementById('inst-plus-tard');
  if (non) non.onclick = () => { try { localStorage.setItem(FERME, '1'); } catch { /* ignore */ } rafraichir(); };
}
