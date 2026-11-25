// Vérifie tous les packs du dossier packs/ : structure, barème, calculs (math.js).
// Usage : npm run verifier-packs   (code de sortie 1 si un pack est invalide)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { packSchema, validerPack, verifierPackMath, type Pack } from '../packages/oc-core/src/index.ts';

writeFileSync('packs/oc-pack.schema.json', JSON.stringify(packSchema, null, 2) + '\n');
let erreurs = 0;
for (const f of readdirSync('packs').filter((x) => x.endsWith('.json') && !x.endsWith('.schema.json')).sort()) {
  const d = JSON.parse(readFileSync(`packs/${f}`, 'utf8'));
  const v = validerPack(d);
  console.log(`\n${v.ok ? '✅' : '❌'} ${f}`);
  for (const e of v.erreurs) console.log('   ✗ ' + e);
  for (const a of v.avertissements) console.log('   ⚠ ' + a);
  if (!v.ok) { erreurs++; continue; }
  for (const r of verifierPackMath(d as Pack)) {
    if (!r.ok) erreurs++;
    console.log(`   ${r.ok ? '✓' : '✗'} ${r.question} — ${r.quoi} : ${r.detail}`);
  }
  for (const a of (d as Pack).meta?.a_relire ?? []) console.log('   👀 à relire : ' + a);
}
process.exit(erreurs ? 1 : 0);
