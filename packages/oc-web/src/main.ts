import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { appliquerLangue, langue, setLangue, t } from './i18n.ts';
import { initStatut, afficherStatut } from './statut.ts';
import { $, toast } from './ui.ts';
import { accueil, creerQcm, epreuve, feuille, listeEpreuves } from './screens/epreuves.ts';
import { copie, serie } from './screens/correction.ts';
import { resultats, sauvegarde } from './screens/resultats.ts';

appliquerLangue();

const routes: [RegExp, (...a: string[]) => unknown][] = [
  [/^\/?$/, accueil],
  [/^\/epreuves$/, () => listeEpreuves('epreuve')],
  [/^\/corriger$/, () => listeEpreuves('serie')],
  [/^\/resultats$/, () => listeEpreuves('resultats')],
  [/^\/creer$/, creerQcm],
  [/^\/epreuve\/(.+)$/, epreuve],
  [/^\/feuille\/(.+)$/, feuille],
  [/^\/serie\/(.+)$/, serie],
  [/^\/copie\/(.+)$/, copie],
  [/^\/resultats\/(.+)$/, resultats],
  [/^\/sauvegarde$/, sauvegarde],
];

function router() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  for (const [re, f] of routes) {
    const m = re.exec(h);
    if (m) {
      Promise.resolve(f(...m.slice(1))).catch((e) => { console.error(e); toast(String(e?.message ?? e)); });
      scrollTo(0, 0);
      return;
    }
  }
  location.hash = '#/';
}

$('#back').onclick = () => (history.length > 1 ? history.back() : (location.hash = '#/'));
$('#lang').onclick = () => {
  setLangue(langue() === 'fr' ? 'ar' : 'fr');
  $('#lang').textContent = t('langue');
  afficherStatut();
  router();
};
$('#lang').textContent = t('langue');
window.addEventListener('hashchange', router);
router();
initStatut();

// Service worker : précache de toute l'application → fonctionne en mode avion.
if ('serviceWorker' in navigator) {
  const maj = registerSW({
    immediate: true,
    onOfflineReady() { toast(t('sw_pret'), 5000); },
    onNeedRefresh() {
      toast(t('maj'), 15000);
      $('#toast').onclick = () => maj(true);
    },
  });
}
// Demande au navigateur de ne pas effacer les données (copies, packs) en cas de manque d'espace.
navigator.storage?.persist?.().catch(() => {});
