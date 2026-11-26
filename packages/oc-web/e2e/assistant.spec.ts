// Parcours hors ligne de l'assistant : installer → mode avion → fermer/rouvrir → importer le sujet
// → résoudre toute l'épreuve → Je bloque → vérifier un raisonnement → exporter le corrigé
// → utiliser le même pack pour corriger les copies.
import { test, expect } from './outils.ts';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const racine = resolve(import.meta.dirname, '../../..');
const PACK = resolve(racine, 'packs/bac-2026-normale-maths-M-TMGM.json');

test('assistant hors ligne : corrigé complet, Je bloque, vérifier mon raisonnement', async ({ page, context, baseURL, couperReseau }) => {
  const externes: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith(baseURL!) && !/^(data|blob):/.test(r.url())) externes.push(r.url()); });

  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Mode avion, puis fermer et rouvrir l'application.
  await couperReseau();
  await page.close();
  const p = await context.newPage();
  p.on('request', (r) => { if (!r.url().startsWith(baseURL!) && !/^(data|blob):/.test(r.url())) externes.push(r.url()); });
  await p.goto(baseURL! + '/');
  await expect(p.locator('h2.accueil')).toHaveText('Que voulez-vous faire ?');
  for (const id of ['go-resoudre', 'go-corriger', 'go-bloque', 'go-verifier', 'go-epreuves', 'go-resultats']) await expect(p.locator('#' + id)).toBeVisible();

  // Importer le sujet (pack).
  await p.click('#go-epreuves');
  const fc = p.waitForEvent('filechooser');
  await p.click('#imp');
  await (await fc).setFiles(PACK);
  await expect(p.locator('main h2')).toContainText('Mathématiques');

  // Résoudre toute l'épreuve.
  await p.goto(baseURL! + '/#/');
  await p.click('#go-resoudre');
  await expect(p.locator('main')).toContainText("n'existe pas encore"); // pas de faux import photo/PDF
  await p.locator('[data-pack]').first().click();
  await expect(p.locator('#bilan')).toBeVisible();
  const resolues = Number(await p.locator('#nb-resolues').textContent());
  const aVerifier = Number(await p.locator('#nb-a-verifier').textContent());
  expect(resolues + aVerifier).toBe(27);
  expect(aVerifier).toBeGreaterThan(0);
  await expect(p.locator('main')).toContainText('Barème proposé — non officiel');
  await expect(p.locator('details.fiche')).toHaveCount(27);

  // Filtre « à vérifier » : les questions douteuses ne sont jamais cachées.
  await p.click('#filtre');
  await expect(p.locator('details.fiche')).toHaveCount(aVerifier);
  await p.click('#filtre');
  await expect(p.locator('details.fiche')).toHaveCount(27);

  // Ouvrir une question : solution + confiance en 4 catégories + Je bloque.
  const f = p.locator('details.fiche').first();
  await f.locator('summary').click();
  await expect(f.locator('.solution')).toContainText('Confiance');
  await expect(f.locator('.solution')).toContainText('Lecture');
  await f.locator('[data-a="pas"]').click();
  await expect(f.locator('.zone ol.etapes li')).toHaveCount(1);
  await f.locator('[data-a="met"]').click();
  await expect(f.locator('.zone')).not.toBeEmpty();

  // Export du corrigé (fichier HTML lisible).
  const dl = p.waitForEvent('download');
  await p.click('#expc');
  const fichier = await (await dl).path();
  const html = readFileSync(fichier!, 'utf8');
  expect(html).toContain('Corrigé complet');
  expect(html).toContain('non officiel');

  // Utiliser le même pack pour corriger les copies.
  await p.click('#utiliser');
  await expect(p).toHaveURL(/#\/serie\//);

  // Je bloque : question libre de maths.
  await p.goto(baseURL! + '/#/bloque');
  await p.fill('#ql', 'Résous x^2 - 5x + 6 = 0');
  await p.click('#ql-ok');
  await expect(p.locator('#ql-res')).toContainText('S = { 2 ; 3 }');
  await p.fill('#ql', 'Explique la photosynthèse');
  await p.click('#ql-ok');
  await expect(p.locator('#ql-res')).toContainText('Information insuffisante');

  // Vérifier mon raisonnement : erreur trouvée à l'étape 2, puis erreur entraînée.
  await p.goto(baseURL! + '/#/verifier');
  await p.fill('.dem', 'x^2 - 5x + 6 = 0\n(x - 2)(x - 4) = 0\nx = 2 ou x = 4');
  await p.click('details.ctx summary');
  await p.fill('.c-eq', 'x^2 - 5x + 6 = 0');
  await p.click('.v-ok');
  await expect(p.locator('.l-erreur')).toHaveCount(1);
  await expect(p.locator('.l-entrainee')).toHaveCount(1);
  await expect(p.locator('#conclusion')).toContainText('étape 2');

  expect(externes).toEqual([]);
});
