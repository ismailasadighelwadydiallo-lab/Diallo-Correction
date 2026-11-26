// Import d'un sujet (PDF, photo, scan, arabe) en mode avion : lecture sur l'appareil,
// découpage, enregistrement, corrigé complet. Mesure la lecture sur des sujets générés.
import { test, expect } from './outils.ts';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

const S = resolve(import.meta.dirname, '../../../fixtures/sujets');

/** Exactitude des caractères (1 − distance d'édition / longueur), espaces ignorés. */
function exactitude(lu: string, ref: string) {
  const a = lu.replace(/\s+/g, ''), b = ref.replace(/\s+/g, '');
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prec = cur;
  }
  return 1 - prec[b.length] / b.length;
}

async function importer(p: Page, bouton: string, fichier: string, langue = 'fra') {
  await p.goto(p.url().replace(/#.*$/, '') + '#/');
  await p.goto(p.url().replace(/#.*$/, '') + '#/importer');
  await expect(p.locator('#texte-lu')).toHaveCount(0);
  await p.selectOption('#imp-langue', langue);
  const fc = p.waitForEvent('filechooser');
  await p.click(bouton);
  await (await fc).setFiles(resolve(S, fichier));
  await expect(p.locator('#texte-lu')).toBeVisible({ timeout: 180_000 });
  return p.locator('#texte-lu').inputValue();
}

test('import du sujet hors ligne : PDF, photo, PDF scanné, arabe', async ({ page: p, baseURL, couperReseau }) => {
  test.setTimeout(600_000);
  const externes: string[] = [];
  p.on('request', (r) => { if (!r.url().startsWith(baseURL!) && !/^(data|blob):/.test(r.url())) externes.push(r.url()); });
  await p.goto('/');
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  await p.reload();
  await expect.poll(() => p.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  // Avec Internet : préparer la lecture des photos (français + arabe), une seule fois.
  await p.goto(baseURL! + '/#/importer');
  await p.selectOption('#imp-langue', 'fra+ara');
  await p.click('#prep-ocr');
  await expect(p.locator('#ocr-etat')).toContainText('prête hors ligne', { timeout: 180_000 });

  await couperReseau();
  await p.reload();

  // 1. PDF à texte intégré : lecture exacte, découpage, résolution.
  const t1 = await importer(p, '#imp-pdf', 'sujet-maths.pdf');
  console.log('--- PDF texte ---\n' + t1);
  await expect(p.locator('#lu-source')).toContainText('directement dans le PDF');
  await p.click('#decouper');
  await expect(p.locator('.q-dec')).toHaveCount(6);
  await p.click('#enregistrer');
  await expect(p.locator('#bilan')).toBeVisible();
  console.log('PDF texte → résolues', await p.locator('#nb-resolues').textContent(), '/ à vérifier', await p.locator('#nb-a-verifier').textContent());
  const f1 = p.locator('details.fiche').first();
  await f1.locator('summary').click();
  await expect(f1.locator('.solution')).toContainText('S = { 2 ; 3 }');

  // 2. Photo au téléphone (inclinée, ombre, flou).
  const t2 = await importer(p, '#imp-images', 'sujet-maths-photo.jpg');
  console.log('--- photo --- confiance', await p.locator('#lu-confiance').textContent() + '\n' + t2);
  await p.click('#decouper');
  const e2 = exactitude(t2, t1);
  console.log(`MESURE photo : exactitude ${(e2 * 100).toFixed(1)} %`);
  expect(e2).toBeGreaterThan(0.9);
  await expect(p.locator('.q-dec')).toHaveCount(6);

  // 3. PDF scanné (image seulement).
  const t3 = await importer(p, '#imp-pdf', 'sujet-maths-scan.pdf');
  console.log('--- PDF scanné --- confiance', await p.locator('#lu-confiance').textContent() + '\n' + t3);
  await expect(p.locator('#lu-source')).toContainText('OCR');
  const e3 = exactitude(t3, t1);
  console.log(`MESURE PDF scanné : exactitude ${(e3 * 100).toFixed(1)} %`);
  expect(e3).toBeGreaterThan(0.9);

  // 4. Sujet en arabe.
  const t4 = await importer(p, '#imp-images', 'sujet-arabe.png', 'ara');
  console.log('--- arabe --- confiance', await p.locator('#lu-confiance').textContent() + '\n' + t4);
  await p.click('#decouper');
  const ref = 'امتحان الباكالوريا 2026 - التربية الإسلامية التمرين الأول (4 نقاط) 1) عرف الصلاة لغة واصطلاحا. (2 ن) 2) اذكر أركان الإسلام. (2 ن) التمرين الثاني (6 نقاط) 1) اشرح الحديث الشريف. (6 ن)';
  const e4 = exactitude(t4, ref);
  console.log(`MESURE arabe : exactitude ${(e4 * 100).toFixed(1)} %`);
  expect(e4).toBeGreaterThan(0.9);
  await expect(p.locator('.exo-dec')).toHaveCount(2);
  await expect(p.locator('.q-dec')).toHaveCount(3);
  await p.click('#enregistrer');
  await expect(p.locator('#nb-a-verifier')).toHaveText('3'); // rédaction : jamais « résolu » sans corrigé

  expect(externes).toEqual([]);
});
