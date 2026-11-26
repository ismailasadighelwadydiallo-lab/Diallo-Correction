// Copie les fichiers de lecture de texte (OCR) dans public/ocr/ : ils sont servis par
// l'application elle-même, jamais par un CDN. Lancé avant chaque build et en développement.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const req = createRequire(import.meta.url);
const dossier = (p: string) => dirname(req.resolve(p + '/package.json'));
const sortie = resolve(import.meta.dirname, '../public/ocr');
mkdirSync(sortie, { recursive: true });

const fichiers: [string, string][] = [
  [join(dossier('tesseract.js'), 'dist/worker.min.js'), 'worker.min.js'],
  // Moteurs LSTM seulement (le mode de reconnaissance utilisé) ; Tesseract choisit selon le navigateur.
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']
    .map((f) => [join(dossier('tesseract.js-core'), f), f] as [string, string]),
  // Langues : modèles « best_int » (plus précis), compressés.
  [join(dossier('@tesseract.js-data/fra'), '4.0.0_best_int/fra.traineddata.gz'), 'fra.traineddata.gz'],
  [join(dossier('@tesseract.js-data/ara'), '4.0.0_best_int/ara.traineddata.gz'), 'ara.traineddata.gz'],
  // Décodeurs d'images de pdf.js (JPEG 2000, couleurs), pour les PDF scannés.
  [join(dossier('pdfjs-dist'), 'wasm/openjpeg.wasm'), 'openjpeg.wasm'],
  [join(dossier('pdfjs-dist'), 'wasm/qcms_bg.wasm'), 'qcms_bg.wasm'],
];
for (const [de, vers] of fichiers) {
  if (!existsSync(de)) throw new Error(`fichier OCR introuvable : ${de}`);
  copyFileSync(de, join(sortie, vers));
}
console.log(`OCR : ${fichiers.length} fichiers copiés dans public/ocr/`);
