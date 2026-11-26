// Mode avion pour tous les navigateurs.
//
// Chaque test a son propre serveur de l'application. `couperReseau()` l'ARRÊTE vraiment (comme un
// téléphone qui quitte le Wi-Fi), puis coupe le réseau du navigateur. Sur WebKit, la coupure de
// Playwright (`setOffline`) empêche même le service worker de répondre (« WebKit encountered an
// internal error »), ce que ne fait pas Safari en vrai : sur WebKit on se contente donc d'arrêter le
// serveur, ce qui suffit à prouver que tout vient du service worker.
import { test as base, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';

async function repond(url: string) { try { await fetch(url); return true; } catch { return false; } }
async function attendre(url: string, ok: boolean) {
  const fin = Date.now() + 30_000;
  while (Date.now() < fin) { if ((await repond(url)) === ok) return; await new Promise((r) => setTimeout(r, 150)); }
  throw new Error(`${url} : ${ok ? 'ne démarre pas' : 'ne s\'arrête pas'}`);
}

export const test = base.extend<{ couperReseau: () => Promise<void> }>({
  baseURL: async ({}, use, info) => {
    const port = 4300 + info.parallelIndex * 7 + (info.retry % 7);
    const url = `http://localhost:${port}`;
    const srv: ChildProcess = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
      cwd: import.meta.dirname + '/..', stdio: 'ignore', detached: true,
    });
    const arreter = () => { try { process.kill(-srv.pid!, 'SIGTERM'); } catch { /* déjà arrêté */ } };
    (info as unknown as { __arreter: () => void }).__arreter = arreter;
    await attendre(url, true);
    await use(url);
    arreter();
    await attendre(url, false).catch(() => {});
  },
  couperReseau: async ({ context, browserName, baseURL }, use, info) => {
    await use(async () => {
      (info as unknown as { __arreter: () => void }).__arreter();
      await attendre(baseURL!, false);
      if (browserName !== 'webkit') await context.setOffline(true);
    });
  },
});
export { expect };
