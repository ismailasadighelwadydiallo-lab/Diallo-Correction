// Indicateur permanent du mode : 🟢 local / 🟣 serveur local / 🔵 cloud (jamais sans accord).
// La seule requête faite ici vise la même origine que l'application (/api/info) :
// si l'application est servie par oc-server sur le Wi-Fi de l'école, il répond ; sinon rien.
import { t } from './i18n.ts';
import { $ } from './ui.ts';

export type Mode = 'local' | 'serveur' | 'cloud';
let mode: Mode = 'local';
export const modeActuel = () => mode;

export async function detecterServeur(): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch('/api/info', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(to);
    if (!r.ok) return false;
    const j = await r.json();
    return j?.app === 'oc-server';
  } catch {
    return false;
  }
}

export function afficherStatut() {
  const el = $('#statut');
  const m = {
    local: ['🟢', t('statut_local')],
    serveur: ['🟣', t('statut_serveur')],
    cloud: ['🔵', t('statut_cloud')],
  }[mode];
  el.textContent = `${m[0]} ${m[1]}`;
  el.dataset.mode = mode;
  el.title = t('statut_aide');
}

export async function initStatut() {
  afficherStatut();
  const maj = async () => {
    mode = (await detecterServeur()) ? 'serveur' : 'local';
    afficherStatut();
  };
  await maj();
  window.addEventListener('online', maj);
  window.addEventListener('offline', maj);
}
