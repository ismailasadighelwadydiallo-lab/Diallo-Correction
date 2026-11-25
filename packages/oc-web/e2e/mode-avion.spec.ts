// Test « mode avion » : après une première visite, le réseau est coupé.
// L'application doit s'ouvrir, importer un pack, corriger une feuille simulée et afficher la note.
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const racine = resolve(import.meta.dirname, '../../..');
const PACK = resolve(racine, 'packs/demo-devoir-qcm.json');
const FEUILLE1 = resolve(racine, 'fixtures/feuilles/eleve1-inclinee.png');
const FEUILLE2 = resolve(racine, 'fixtures/feuilles/eleve2-crayon-ombre.png');

test('mode avion : ouvrir, importer un pack, corriger, voir la note, exporter', async ({ page, context, baseURL }) => {
  const externes: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) externes.push(r.url()); });

  // 1. Première visite (avec réseau) : le service worker installe toute l'application.
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // 2. Mode avion.
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('h2.accueil')).toHaveText('Que voulez-vous faire ?');
  await expect(page.locator('#statut')).toContainText('🟢 IA locale · Hors ligne');

  // 3. Importer un pack.
  await page.click('#go-epreuves');
  const fc = page.waitForEvent('filechooser');
  await page.click('#imp');
  await (await fc).setFiles(PACK);
  await expect(page.locator('main h2')).toHaveText('Devoir de démonstration (QCM)');

  // 4. Correction en série : deux photos importées depuis la « galerie ».
  await page.click('#go-serie');
  const fc2 = page.waitForEvent('filechooser');
  await page.click('#gal');
  await (await fc2).setFiles([FEUILLE1, FEUILLE2]);
  await expect(page.locator('#liste .list-item')).toHaveCount(2, { timeout: 20_000 });
  const notes = await page.locator('#liste .note').allTextContents();
  expect(notes.sort()).toEqual(['15/20', '16/20']);
  await expect(page.locator('#liste .tag.warn')).toHaveCount(1); // la double case est signalée, sans bloquer

  // 5. Copie corrigée : note, explications, modification par l'enseignant.
  await page.locator('#liste .list-item', { hasText: '16/20' }).click();
  await expect(page.locator('#note20')).toHaveText('16 / 20');
  await expect(page.locator('.qres[data-qid="Ex1-Q5"] .expl')).toContainText('la bonne réponse est');
  await page.click('[data-mod="Ex1-Q5"]');
  await page.selectOption('.qres[data-qid="Ex1-Q5"] select', '1');
  await page.fill('.qres[data-qid="Ex1-Q5"] .motif', 'case mal lue');
  await page.click('.qres[data-qid="Ex1-Q5"] .ok');
  await expect(page.locator('#note20')).toHaveText('17 / 20');
  await expect(page.locator('main')).toContainText('case mal lue');

  // 6. Résultats de la classe et export CSV (hors ligne).
  await page.goto('/#/resultats/demo-devoir-qcm');
  await expect(page.locator('#moyenne')).toHaveText('16');
  await expect(page.locator('#mediane')).toHaveText('16');
  const dl = page.waitForEvent('download');
  await page.click('#csv');
  const csv = readFileSync(await (await dl).path(), 'utf8');
  expect(csv).toContain('"17"');

  // 7. Interface en arabe (droite à gauche).
  await page.goto('/#/');
  await page.click('#lang');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('h2.accueil')).toHaveText('ماذا تريد أن تفعل؟');

  // Aucune requête vers Internet pendant tout le test.
  expect(externes).toEqual([]);
});

test('feuille illisible : message clair, rien de bloqué', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.click('#go-epreuves');
  const fc = page.waitForEvent('filechooser');
  await page.click('#imp');
  await (await fc).setFiles(PACK);
  await page.click('#go-serie');
  const fc2 = page.waitForEvent('filechooser');
  await page.click('#gal');
  await (await fc2).setFiles(resolve(racine, 'packages/oc-web/public/icone-512.png'));
  await expect(page.locator('#echec')).toContainText('Copie non reconnue');
});

test('mode avion : le pack réel Maths M & TMGM 2026 s\'importe et sa feuille-réponse s\'affiche', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.click('#go-epreuves');
  const fc = page.waitForEvent('filechooser');
  await page.click('#imp');
  await (await fc).setFiles(resolve(racine, 'packs/bac-2026-normale-maths-M-TMGM.json'));
  await expect(page.locator('main h2')).toContainText('Mathématiques — Séries M & TMGM');
  await expect(page.locator('main')).toContainText('27 questions');
  await page.click('a[href^="#/feuille/"]');
  await expect(page.locator('main svg circle').first()).toBeVisible();
  expect(await page.locator('main svg circle').count()).toBeGreaterThan(27 * 3);
});
