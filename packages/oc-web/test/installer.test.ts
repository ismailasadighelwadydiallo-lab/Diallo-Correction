import { describe, it, expect } from 'vitest';
import { conseilInstallation } from '../src/installer.ts';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  ipadOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0',
  firefoxPc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36 Edg/138.0',
};

describe('conseil d\'installation par navigateur', () => {
  it('iPhone, iPad (même déguisé en Mac) et Chrome sur iPhone → geste Safari', () => {
    expect(conseilInstallation(UA.iphone, true)).toBe('inst_ios');
    expect(conseilInstallation(UA.ipadOS, true)).toBe('inst_ios');
    expect(conseilInstallation(UA.chromeIos, true)).toBe('inst_ios');
  });
  it('Safari Mac → Ajouter au Dock ; Chrome Mac → conseil général', () => {
    expect(conseilInstallation(UA.ipadOS, false)).toBe('inst_mac');
    expect(conseilInstallation(UA.macChrome, false)).toBe('inst_autre');
  });
  it('Firefox Android / ordinateur', () => {
    expect(conseilInstallation(UA.firefoxAndroid, true)).toBe('inst_firefox_android');
    expect(conseilInstallation(UA.firefoxPc, false)).toBe('inst_firefox_pc');
  });
  it('Edge → conseil général (le vrai bouton apparaît avec beforeinstallprompt)', () => {
    expect(conseilInstallation(UA.edge, false)).toBe('inst_autre');
  });
});
