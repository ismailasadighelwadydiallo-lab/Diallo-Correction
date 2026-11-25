// Lancement : npm run serveur  (depuis la racine du dépôt)
// Variables : OC_PORT_HTTPS (8443), OC_PORT_HTTP (8080), OC_NOM, OC_PACKS, OC_MODELES, OC_HTTP_SEUL=1
import { resolve } from 'node:path';
import { adressesLocales, creerServeur } from './server.ts';
import { certificats } from './certs.ts';

const racine = resolve(import.meta.dirname, '../../..');
const web = resolve(racine, 'packages/oc-web/dist');
const packs = resolve(process.env.OC_PACKS ?? resolve(racine, 'packs'));
const modeles = resolve(process.env.OC_MODELES ?? resolve(racine, 'packages/oc-server/modeles'));
const nom = process.env.OC_NOM ?? 'Serveur local';
const portHttps = Number(process.env.OC_PORT_HTTPS ?? 8443);
const portHttp = Number(process.env.OC_PORT_HTTP ?? 8080);
const httpSeul = process.env.OC_HTTP_SEUL === '1';

const ips = adressesLocales();
const lignes: string[] = [];

let ca: string | undefined;
if (!httpSeul) {
  const c = await certificats(resolve(racine, 'packages/oc-server/certs'), [...ips, '127.0.0.1']);
  ca = c.ca;
  const https = await creerServeur({ web, packs, modeles, ca, nom, portHttp, portHttps, fastify: { https: { key: c.cle, cert: c.cert } } });
  await https.listen({ host: '0.0.0.0', port: portHttps });
  lignes.push(`HTTPS (installation de l'application) :`, ...ips.map((ip) => `   https://${ip}:${portHttps}/`));
}
const http = await creerServeur({ web, packs, modeles, ca, nom, portHttp, portHttps });
await http.listen({ host: '0.0.0.0', port: portHttp });
lignes.push(`Mode d'emploi pour les téléphones :`, ...ips.map((ip) => `   http://${ip}:${portHttp}/installer`), `HTTP :`, ...ips.map((ip) => `   http://${ip}:${portHttp}/`), `   http://localhost:${portHttp}/`);
if (ca) lignes.push(`Certificat à installer une fois sur chaque téléphone :`, ...ips.map((ip) => `   http://${ip}:${portHttp}/ca.crt`));

console.log(`\nOffline Correction — ${nom}\nAucune connexion Internet n'est utilisée.\n\n${lignes.join('\n')}\n\nPacks : ${packs}\nModèles IA : ${modeles}\nCtrl+C pour arrêter.\n`);
