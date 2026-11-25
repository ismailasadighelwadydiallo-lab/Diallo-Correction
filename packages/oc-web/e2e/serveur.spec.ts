// Le téléphone installe l'application depuis le serveur local de l'école (HTTPS sur le Wi-Fi),
// voit l'indicateur 🟣, importe un pack du serveur, puis tout continue sans le serveur.
import { test, expect, chromium, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { X509Certificate, createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

const racine = resolve(import.meta.dirname, '../../..');
const ip = Object.values(networkInterfaces()).flat().find((a) => a && a.family === 'IPv4' && !a.internal)?.address ?? '127.0.0.1';
const URL_HTTPS = `https://${ip}:9443`;
let srv: ChildProcess;

test.beforeAll(async () => {
  srv = spawn(process.execPath, ['packages/oc-server/src/main.ts'], { cwd: racine, env: { ...process.env, OC_PORT_HTTPS: '9443', OC_PORT_HTTP: '9080', OC_NOM: 'Test' }, stdio: 'pipe' });
  await new Promise<void>((ok, ko) => {
    const to = setTimeout(() => ko(new Error('serveur non démarré')), 20_000);
    srv.stdout!.on('data', (d) => { if (String(d).includes('Ctrl+C')) { clearTimeout(to); ok(); } });
  });
});
test.afterAll(() => { srv?.kill(); });

test('installation depuis le serveur local, puis fonctionnement sans serveur', async () => {
  // Le Chromium de test fait confiance au certificat de l'école (empreinte de la clé),
  // comme un téléphone sur lequel ca.crt a été installé. Sans cela, Chrome refuse le service worker.
  const cert = new X509Certificate(readFileSync(resolve(racine, 'packages/oc-server/certs/serveur.crt')));
  const spki = createHash('sha256').update(cert.publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
  const browser = await chromium.launch({ args: ['--proxy-server=direct://', '--proxy-bypass-list=*', `--ignore-certificate-errors-spki-list=${spki}`] });
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  const externes: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith(URL_HTTPS) && !/^(data|blob):/.test(r.url())) externes.push(r.url()); });
  await page.goto(URL_HTTPS + '/');
  await expect(page.locator('#statut')).toContainText('🟣 Serveur local');
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const manifeste = await page.evaluate(async () => (await fetch(document.querySelector<HTMLLinkElement>('link[rel=manifest]')!.href)).json());
  expect(manifeste.name).toBe('Offline Correction');

  // importer un pack proposé par le serveur
  await page.click('#go-epreuves');
  await page.click('#srv');
  await page.click('[data-f="demo-devoir-qcm.json"]');
  await expect(page.locator('main h2')).toHaveText('Devoir de démonstration (QCM)');

  // serveur éteint / hors Wi-Fi : l'application reste utilisable
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#statut')).toContainText('🟢');
  await page.goto(URL_HTTPS + '/#/epreuves');
  await expect(page.locator('[data-pack="demo-devoir-qcm"]')).toBeVisible();
  expect(externes).toEqual([]);
  await browser.close();
});
