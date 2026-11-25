// Aide à l'installation : chaque navigateur reçoit le bon conseil, et l'aide se ferme.
import { test, expect } from '@playwright/test';

const attendu: Record<string, RegExp> = {
  'iphone-safari': /Partager ⬆️/,
  'ipad-safari': /Partager ⬆️/,
  'mac-safari': /Ajouter au Dock/,
  'pc-firefox': /Firefox sur ordinateur/,
  'mobile-firefox': /Firefox sur ordinateur/,
};

test('aide à l\'installation adaptée au navigateur', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.locator('#installer')).toBeVisible();
  await expect(page.locator('#installer')).toContainText(attendu[info.project.name] ?? /Installer l'application/);
  await page.click('#inst-plus-tard');
  await expect(page.locator('#installer')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('h2.accueil')).toBeVisible();
  await expect(page.locator('#installer')).toHaveCount(0);
});
