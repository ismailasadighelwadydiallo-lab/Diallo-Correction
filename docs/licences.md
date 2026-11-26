# Licences des composants

Tous les composants livrés autorisent un **usage commercial**. Versions installées le 26/11/2026
(`package-lock.json`). Tailles **mesurées** sur le build (`npm run build`), sauf mention « annoncé ».
Dépendances indirectes : MIT, Apache-2.0, BSD, ISC, 0BSD, BlueOak (permissives). **Aucune licence copyleft.**

| Nom | Version | Usage dans le projet | Licence | Usage commercial | Taille | Limites | Alternative |
|---|---|---|---|---|---|---|---|
| math.js | 15.3.0 | Solveur local, vérification des calculs, dérivées, racines | Apache-2.0 | Oui | ≈ 737 Ko minifié (dans main.js) | Pas de primitives symboliques ; limites seulement par contrôle numérique | Nerdamer (MIT), Algebrite (MIT) |
| Dexie | 4.4.7 | Base locale IndexedDB (packs, copies, photos) | Apache-2.0 | Oui | ≈ 98 Ko | Dépend du stockage du navigateur (peut être effacé sur iPhone si l'app n'est pas installée) | idb (ISC) |
| Ajv | 8.20.0 | Validation des packs (JSON Schema) | MIT | Oui | ≈ 121 Ko | — | — |
| Vite | 7.3.8 | Construction de l'application | MIT | Oui | 0 (outil) | — | — |
| vite-plugin-pwa / Workbox | 1.3.0 / 7.4.1 | Service worker, fonctionnement hors ligne | MIT | Oui | sw.js + workbox ≈ 17 Ko | — | Service worker écrit à la main |
| WebLLM (@mlc-ai/web-llm) | 0.2.89 | IA locale avec WebGPU (page labo) | Apache-2.0 | Oui | 6,2 Mo, page labo seulement | Exige WebGPU | wllama |
| wllama | 4.0.0 | IA locale sur processeur (page labo) | MIT | Oui | 105 Ko + 10,8 Mo de wasm, page labo seulement | Lent sur téléphone | — |
| Fastify + @fastify/static | 5.12.8 / 9.3.0 | Serveur local de l'école | MIT | Oui | — (ordinateur) | — | Express (MIT) |
| @peculiar/x509 | 1.14.3 | Certificats HTTPS de l'école | MIT | Oui | — (ordinateur) | — | OpenSSL |
| Tesseract.js (+ tesseract.js-core) | 7.0.0 / 7.0.0 | Lecture du texte des photos et des PDF scannés (OCR) | Apache-2.0 | Oui | 111 Ko + un moteur de 3,9 Mo (téléchargés une fois, à la demande) | Formules mal lues (exposants, fractions) ; écriture manuscrite non gérée | — |
| Données de langue Tesseract `fra`, `ara` (best_int, via @tesseract.js-data) | 4.0.0 | Modèles de lecture français et arabe | Apache-2.0 (tessdata) ; paquet npm MIT | Oui | 0,7 Mo + 1,7 Mo (à la demande) | — | modèles « fast » (plus petits, moins précis) |
| pdf.js (pdfjs-dist) | 5.4.394 | Lecture des PDF (texte intégré, ou images des pages scannées) | Apache-2.0 | Oui | ≈ 1,4 Mo (dans l'application, hors ligne) | Polices CJK non incluses (inutile ici) | — |
| TypeScript | 5.9.3 | Langage | Apache-2.0 | Oui | 0 (outil) | — | — |
| Vitest | 3.2.7 | Tests unitaires | MIT | Oui | 0 (outil) | — | — |
| Playwright | 1.63.0 | Tests navigateurs | Apache-2.0 | Oui | 0 (outil) | — | — |

## Modèles d'IA (page labo, téléchargés seulement si on l'ouvre)

| Modèle | Licence | Usage commercial | Taille (annoncée) | Remarque |
|---|---|---|---|---|
| Qwen3 0.6B / 1.7B | Apache-2.0 | Oui | 1,4 Go / 2,0 Go de mémoire GPU | Retenus |
| Qwen2.5 0.5B / 1.5B Instruct | Apache-2.0 | Oui | ≈ 0,4 Go / 1,6 Go | Retenus |
| Qwen2.5 3B | Qwen Research | **Non** | — | Écarté |
| Llama 3.2 1B | Llama Community | Sous conditions | — | Écarté |
| Gemma 2 2B | Conditions Gemma | Sous conditions | — | Écarté |

## Pas encore intégrés

| Besoin | Piste | Licence |
|---|---|---|
| Sujets Word (.docx) | lecture du XML du fichier (fflate) | MIT |
| Écriture manuscrite des copies | à évaluer (TrOCR, modèles légers) | à vérifier |

Le solveur, le corrigé de référence et « Vérifier mon raisonnement » n'ajoutent **aucune
dépendance** : ils utilisent math.js, déjà présent.
