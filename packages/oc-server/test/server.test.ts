import { describe, expect, it, beforeAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { X509Certificate } from 'node:crypto';
import { creerServeur, listerPacks } from '../src/server.ts';
import { certificats } from '../src/certs.ts';

const racine = resolve(import.meta.dirname, '../../..');
let web: string, packs: string;

beforeAll(() => {
  const d = mkdtempSync(join(tmpdir(), 'oc-srv-'));
  web = join(d, 'web');
  packs = join(d, 'packs');
  mkdirSync(web); mkdirSync(packs);
  writeFileSync(join(web, 'index.html'), '<!doctype html><title>OC</title>');
  writeFileSync(join(web, 'sw.js'), '// sw');
  writeFileSync(join(web, 'x.wasm'), Buffer.from([0, 97, 115, 109]));
  writeFileSync(join(packs, 'demo.json'), readFileSync(join(racine, 'packs/demo-devoir-qcm.json')));
  writeFileSync(join(packs, 'casse.json'), '{"format":"oc-pack/1"}');
});

describe('oc-server', () => {
  it('sert la PWA, /api/info, les packs validés', async () => {
    const app = await creerServeur({ web, packs, nom: 'Lycée de Kaédi' });
    const info = await app.inject('/api/info');
    expect(info.json()).toMatchObject({ app: 'oc-server', nom: 'Lycée de Kaédi', packs: 1, internet: false });
    const idx = await app.inject('/');
    expect(idx.statusCode).toBe(200);
    expect(idx.body).toContain('<title>OC</title>');
    expect(idx.headers['cache-control']).toBe('no-cache');
    expect((await app.inject('/sw.js')).headers['cache-control']).toBe('no-cache');
    expect((await app.inject('/x.wasm')).headers['content-type']).toBe('application/wasm');
    const liste = (await app.inject('/api/packs')).json();
    expect(liste.find((p: { fichier: string }) => p.fichier === 'demo.json').valide).toBe(true);
    expect(liste.find((p: { fichier: string }) => p.fichier === 'casse.json').valide).toBe(false);
    const pack = await app.inject('/packs/demo.json');
    expect(pack.json().id).toBe('demo-devoir-qcm');
    expect((await app.inject('/ca.crt')).statusCode).toBe(404);
    await app.close();
  });

  it('refuse de démarrer sans PWA construite', async () => {
    await expect(creerServeur({ web: join(web, 'absent'), packs })).rejects.toThrow(/npm run build/);
  });

  it('crée une CA et un certificat serveur valable pour les adresses du Wi-Fi', async () => {
    const d = mkdtempSync(join(tmpdir(), 'oc-certs-'));
    const c = await certificats(d, ['192.168.1.20']);
    const ca = new X509Certificate(c.ca);
    const srv = new X509Certificate(c.cert);
    expect(ca.ca).toBe(true);
    expect(srv.verify(ca.publicKey)).toBe(true);
    expect(srv.subjectAltName).toContain('IP Address:192.168.1.20');
    expect(srv.checkIP('192.168.1.20')).toBe('192.168.1.20');
    // même CA réutilisée, certificat serveur régénéré si l'adresse change
    const c2 = await certificats(d, ['10.0.0.5']);
    expect(c2.ca).toBe(c.ca);
    expect(new X509Certificate(c2.cert).checkIP('10.0.0.5')).toBe('10.0.0.5');
    const app = await creerServeur({ web, packs, ca: c.ca });
    const r = await app.inject('/ca.crt');
    expect(r.headers['content-type']).toBe('application/x-x509-ca-cert');
    await app.close();
  });

  it('listerPacks ignore le schéma', () => {
    writeFileSync(join(packs, 'oc-pack.schema.json'), '{}');
    expect(listerPacks(packs).map((p) => p.fichier)).toEqual(['casse.json', 'demo.json']);
  });
});

describe('page d\'installation', () => {
  it('explique comment installer le certificat puis l\'application', async () => {
    const app = await creerServeur({ web, packs, ca: 'x', portHttp: 8080, portHttps: 8443 });
    const r = await app.inject({ url: '/installer', headers: { host: '192.168.1.20:8080' } });
    expect(r.body).toContain('http://192.168.1.20:8080/ca.crt');
    expect(r.body).toContain('https://192.168.1.20:8443/');
    // une section par type d'appareil
    for (const m of ['Android', 'iPhone / iPad', 'Ordinateur', 'Firefox', 'Sur l\'écran d\'accueil']) expect(r.body).toContain(m);
    await app.close();
  });
});
