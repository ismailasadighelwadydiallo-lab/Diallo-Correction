// Certificats HTTPS pour le Wi-Fi de l'école, générés sur place, sans Internet.
// Chrome n'installe une application web (service worker) que sur une origine « sûre » :
// https://, ou http://localhost. Sur le Wi-Fi (http://192.168.x.x) il faut donc HTTPS.
// On crée une petite autorité de certification (CA) propre à l'école ; chaque téléphone
// l'installe une fois (fichier ca.crt), puis fait confiance au serveur.
import * as x509 from '@peculiar/x509';
import { webcrypto } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

x509.cryptoProvider.set(webcrypto as unknown as Crypto);

const ALG = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' } as const;

async function pemCle(k: CryptoKey) {
  const der = await webcrypto.subtle.exportKey('pkcs8', k as unknown as webcrypto.CryptoKey);
  return `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der).toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`;
}
async function importerCle(pem: string) {
  const der = Buffer.from(pem.replace(/-----[^-]+-----|\s/g, ''), 'base64');
  return webcrypto.subtle.importKey('pkcs8', der, ALG, true, ['sign']) as unknown as Promise<CryptoKey>;
}

const serie = () => Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString('hex').replace(/^[89a-f]/, '1');

export interface Certificats {
  cle: string;
  cert: string;
  ca: string;
  /** Chemin du certificat de la CA à installer sur les téléphones. */
  caFichier: string;
}

/** Crée (ou réutilise) la CA de l'école et un certificat serveur valable pour `ips`. */
export async function certificats(dossier: string, ips: string[], noms: string[] = ['localhost']): Promise<Certificats> {
  mkdirSync(dossier, { recursive: true });
  const caCertF = join(dossier, 'ca.crt'), caCleF = join(dossier, 'ca.key');
  let caCert: x509.X509Certificate, caCle: CryptoKey;
  if (existsSync(caCertF) && existsSync(caCleF)) {
    caCert = new x509.X509Certificate(readFileSync(caCertF, 'utf8'));
    caCle = await importerCle(readFileSync(caCleF, 'utf8'));
  } else {
    const kp = (await webcrypto.subtle.generateKey(ALG, true, ['sign', 'verify'])) as unknown as CryptoKeyPair;
    caCert = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber: serie(),
      name: 'CN=Offline Correction - CA de l\'ecole, O=Offline Correction',
      notBefore: new Date(Date.now() - 86400e3),
      notAfter: new Date(Date.now() + 10 * 365 * 86400e3),
      keys: kp,
      signingAlgorithm: ALG,
      extensions: [
        new x509.BasicConstraintsExtension(true, 0, true),
        new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign, true),
        await x509.SubjectKeyIdentifierExtension.create(kp.publicKey),
      ],
    });
    caCle = kp.privateKey;
    writeFileSync(caCertF, caCert.toString('pem') + '\n');
    writeFileSync(caCleF, await pemCle(caCle), { mode: 0o600 });
  }
  // certificat serveur : régénéré si la liste des adresses a changé
  const cleF = join(dossier, 'serveur.key'), certF = join(dossier, 'serveur.crt'), sanF = join(dossier, 'serveur.san');
  const san = [...ips, ...noms].sort().join(',');
  if (!(existsSync(certF) && existsSync(cleF) && existsSync(sanF) && readFileSync(sanF, 'utf8') === san)) {
    const kp = (await webcrypto.subtle.generateKey(ALG, true, ['sign', 'verify'])) as unknown as CryptoKeyPair;
    const cert = await x509.X509CertificateGenerator.create({
      serialNumber: serie(),
      subject: 'CN=Offline Correction - serveur local',
      issuer: caCert.subject,
      notBefore: new Date(Date.now() - 86400e3),
      // Chrome refuse les certificats serveur valables plus de 398 jours
      notAfter: new Date(Date.now() + 397 * 86400e3),
      signingAlgorithm: ALG,
      publicKey: kp.publicKey,
      signingKey: caCle,
      extensions: [
        new x509.BasicConstraintsExtension(false, undefined, true),
        new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.keyAgreement, true),
        new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.serverAuth]),
        new x509.SubjectAlternativeNameExtension([...ips.map((v) => ({ type: 'ip' as const, value: v })), ...noms.map((v) => ({ type: 'dns' as const, value: v }))]),
        await x509.AuthorityKeyIdentifierExtension.create(caCert),
      ],
    });
    writeFileSync(certF, cert.toString('pem') + '\n' + caCert.toString('pem') + '\n');
    writeFileSync(cleF, await pemCle(kp.privateKey), { mode: 0o600 });
    writeFileSync(sanF, san);
  }
  return { cle: readFileSync(cleF, 'utf8'), cert: readFileSync(certF, 'utf8'), ca: readFileSync(caCertF, 'utf8'), caFichier: caCertF };
}
