// Serveur local de l'école : sert la PWA, les packs et (en option) les modèles d'IA
// sur le Wi-Fi, SANS Internet. Aucune requête sortante.
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
import { validerPack } from 'oc-core';

export const VERSION = '0.1.0';

export interface OptionsServeur {
  /** Dossier de la PWA construite (packages/oc-web/dist). */
  web: string;
  /** Dossier des packs (.json). */
  packs: string;
  /** Dossier des modèles d'IA (optionnel). */
  modeles?: string;
  /** Contenu PEM du certificat de la CA (servi en /ca.crt). */
  ca?: string;
  nom?: string;
  portHttp?: number;
  portHttps?: number;
  /** Options transmises à Fastify (https, logger…). */
  fastify?: FastifyServerOptions & { https?: { key: string; cert: string } | null };
}

export function adressesLocales(): string[] {
  const out: string[] = [];
  for (const l of Object.values(networkInterfaces())) for (const a of l ?? []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}

export interface InfoPack { fichier: string; id?: string; titre?: string; questions?: number; total?: number; valide: boolean; erreurs: string[] }

export function listerPacks(dossier: string): InfoPack[] {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.schema.json'))
    .sort()
    .map((fichier) => {
      try {
        const d = JSON.parse(readFileSync(join(dossier, fichier), 'utf8'));
        const v = validerPack(d);
        return { fichier, id: d.id, titre: d.titre, questions: d.questions?.length, total: d.total, valide: v.ok, erreurs: v.erreurs };
      } catch (e) {
        return { fichier, valide: false, erreurs: [(e as Error).message] };
      }
    });
}

export async function creerServeur(o: OptionsServeur): Promise<FastifyInstance> {
  if (!existsSync(join(o.web, 'index.html'))) throw new Error(`PWA introuvable dans ${o.web}. Lancez d'abord : npm run build`);
  const app = Fastify({ logger: false, ...(o.fastify as object) });

  app.addHook('onSend', async (req, rep) => {
    // le service worker et le manifeste ne doivent pas rester en cache HTTP (mises à jour)
    if (/\/(sw\.js|manifest\.webmanifest|index\.html)?$/.test(req.url.split('?')[0])) rep.header('Cache-Control', 'no-cache');
  });

  app.get('/api/info', async () => ({
    app: 'oc-server', version: VERSION, nom: o.nom ?? 'Serveur local', packs: listerPacks(o.packs).filter((p) => p.valide).length,
    modeles: !!(o.modeles && existsSync(o.modeles)), https: !!o.fastify?.https, internet: false,
  }));
  app.get('/api/packs', async () => listerPacks(o.packs));
  app.get('/ca.crt', async (_req, rep) => {
    if (!o.ca) return rep.code(404).send('Pas de certificat (serveur lancé en HTTP seulement).');
    // type reconnu par Android pour proposer l'installation du certificat
    return rep.type('application/x-x509-ca-cert').header('Content-Disposition', 'attachment; filename="offline-correction-ca.crt"').send(o.ca);
  });

  app.get('/installer', async (req, rep) => {
    const h = (req.headers.host ?? '').split(':')[0];
    const hote = /^[A-Za-z0-9.-]+$/.test(h) ? h : adressesLocales()[0] ?? 'ADRESSE';
    const https = o.portHttps ?? 8443, http = o.portHttp ?? 8080;
    return rep.type('text/html; charset=utf-8').send(pageInstallation(hote, http, https, !!o.ca));
  });

  await app.register(fastifyStatic, { root: resolve(o.web), prefix: '/', index: ['index.html'], cacheControl: true, maxAge: 0 });
  if (existsSync(o.packs)) await app.register(fastifyStatic, { root: resolve(o.packs), prefix: '/packs/', decorateReply: false });
  if (o.modeles && existsSync(o.modeles) && statSync(o.modeles).isDirectory())
    await app.register(fastifyStatic, { root: resolve(o.modeles), prefix: '/modeles/', decorateReply: false, acceptRanges: true });
  return app;
}

/** Page d'aide pour installer l'application sur un téléphone Android (Chrome). */
export function pageInstallation(hote: string, http: number, https: number, avecCa: boolean): string {
  const urlHttps = `https://${hote}:${https}/`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Installer Offline Correction</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:16px;line-height:1.5;color:#14202b}h1{font-size:22px}li{margin:10px 0}a.b{display:inline-block;background:#0b5cad;color:#fff;padding:12px 16px;border-radius:9px;text-decoration:none}code{background:#eef2f6;padding:2px 6px;border-radius:4px}</style></head><body>
<h1>Installer Offline Correction sur ce téléphone</h1>
${avecCa ? `<ol>
<li><b>Une seule fois par téléphone :</b> téléchargez le certificat de l'école<br><a class="b" href="http://${hote}:${http}/ca.crt">⬇️ Télécharger le certificat</a></li>
<li>Ouvrez <b>Paramètres → Sécurité (ou Sécurité et confidentialité) → Plus de paramètres → Chiffrement et identifiants → Installer un certificat → Certificat CA</b>, puis choisissez le fichier <code>offline-correction-ca.crt</code>. (Les noms des menus changent un peu selon les marques.)</li>
<li>Ouvrez l'application dans Chrome :<br><a class="b" href="${urlHttps}">${urlHttps}</a></li>
<li>Dans Chrome, menu <b>⋮ → Installer l'application</b> (ou « Ajouter à l'écran d'accueil »).</li>
<li>Ouvrez l'application une fois avec le Wi-Fi : un message indique qu'elle est prête pour le mode avion.</li>
</ol>` : `<p>Le serveur fonctionne en HTTP seulement. Chrome n'installe une application qu'en HTTPS : relancez le serveur sans <code>OC_HTTP_SEUL=1</code>, ou suivez l'autre méthode du README (réglage <code>chrome://flags</code>).</p>`}
<p>Le serveur de l'école n'utilise jamais Internet.</p></body></html>`;
}
