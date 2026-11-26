// La page labo s'ouvre en mode avion, détecte l'appareil et produit un rapport.
// (Le chargement réel d'un modèle demande un téléphone : il se mesure sur le terrain.)
import { test, expect } from './outils.ts';

test('labo : ouverture en mode avion, détection, rapport', async ({ page, couperReseau, browserName }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await couperReseau();
  await page.goto('/labo.html');
  await expect(page.locator('#appareil')).toContainText('WebGPU');
  // (sur WebKit, le navigateur n'est pas mis « hors ligne » : seul le serveur est arrêté, voir outils.ts)
  if (browserName !== 'webkit') await expect(page.locator('#appareil')).toContainText('hors ligne');
  await expect(page.locator('#rapport')).toHaveValue(/rapport labo IA locale/);
  // charger un modèle sans réseau et sans cache : message clair, pas de plantage
  await page.selectOption('#modele', 'qwen2.5-0.5b-wllama');
  await page.click('#charger');
  await expect(page.locator('#ptexte')).toContainText('❌', { timeout: 30_000 });
  await expect(page.locator('#rapport')).toHaveValue(/Chargement :/);
});
