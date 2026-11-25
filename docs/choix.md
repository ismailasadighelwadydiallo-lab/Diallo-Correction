# Choix techniques, licences et limites

Toutes les bibliothèques ci-dessous autorisent un **usage commercial**. Les tailles sont
**mesurées** sur le build du 25/11/2026 (`npm run build`), sauf mention « annoncé ».

## Tableau des choix

| Besoin | Choix retenu | Version | Licence | Taille dans l'application | Remarque |
|---|---|---|---|---|---|
| Langage | TypeScript | 5.9.3 | Apache-2.0 | 0 (outil de dev) | Exécuté dans Node 22.18+ sans compilation (suppression des types), et par Vite dans le navigateur. |
| Monorepo | npm workspaces | npm 10 | Artistic-2.0 | 0 | Pas d'outil en plus (pas de pnpm/turbo). |
| PWA | Vite + vite-plugin-pwa (Workbox) | 7.3 / 1.3.0 / 7.4 | MIT | sw.js + workbox : 17 Ko | Précache de toute l'application ; aucune règle de cache vers Internet. |
| Stockage local | IndexedDB via Dexie | 4.4.7 | Apache-2.0 | 98 Ko (minifié, dans main.js) | Copies, packs, photos réduites (JPEG). `navigator.storage.persist()` demandé. |
| Lecture des feuilles | Code de `correcteur.html` porté dans `oc-core` | — | (projet) | 13 Ko de source TypeScript | Vision classique, sans IA. |
| Validation des packs | JSON Schema (draft-07) + Ajv | 8.20.0 | MIT | 121 Ko (minifié) | Schéma exporté dans `packs/oc-pack.schema.json`. |
| Moteur mathématique | math.js | 15.3.0 | Apache-2.0 | 737 Ko (minifié, seul) | Dérivées symboliques, comparaison numérique d'expressions. |
| IA locale (WebGPU) | WebLLM (@mlc-ai/web-llm) | 0.2.89 | Apache-2.0 | 6,2 Mo (chargé seulement par la page labo) | Modèles téléchargés une fois depuis Hugging Face ou le serveur local. |
| IA locale (sans WebGPU) | wllama (llama.cpp en WebAssembly) | 4.0.0 | MIT | 105 Ko + 10,8 Mo de wasm (page labo seulement) | Fonctionne sur le processeur, plus lent. |
| Serveur local | Node + Fastify + @fastify/static | 5.12.8 / 9.3.0 | MIT | — | Sert la PWA, les packs, les modèles. |
| Certificats HTTPS de l'école | @peculiar/x509 (WebCrypto de Node) | 1.14.3 | MIT | — | CA locale + certificat serveur, sans OpenSSL ni Internet. |
| Tests | Vitest + Playwright | 3.2.7 / 1.63.0 | MIT / Apache-2.0 | 0 | Vitest 4 refusait de s'installer (bogue npm « edgesOut ») : Vitest 3.2 utilisé. |

Dépendances indirectes livrées : 85 MIT, 7 Apache-2.0, 6 BSD-3-Clause, 5 ISC, 2 0BSD,
5 BlueOak-1.0.0 (glob/minimatch, côté serveur, licence permissive). Aucune licence copyleft.

**Taille de l'application installée sur le téléphone** (précache du service worker) : **972 Ko**.
La page labo ajoute 6,2 Mo (WebLLM) ou 10,9 Mo (wllama) **seulement si on l'ouvre**, plus le modèle.

## Écarts par rapport au cahier des charges

- **Vitest 3.2 au lieu de 4** : npm 10.9 plante à l'installation de Vitest 4 dans ce monorepo.
  Aucune différence pour nos tests. À réessayer avec un npm plus récent.
- **Pas de framework d'interface** (React, Vue…) : interface en TypeScript simple, comme
  `correcteur.html`. Moins de code à télécharger, rien à apprendre pour relire le code.
- **OCR (Tesseract.js) pas encore intégré** : il n'était pas dans les étapes 1 à 7. Prévu :
  Tesseract.js 7 (Apache-2.0) avec `fra.traineddata` et `ara.traineddata` servis par
  l'application (pas de CDN : il faudra régler `workerPath`, `corePath` et `langPath`).

## Modèles d'IA candidats (phase 0)

| Modèle | Moteur | Licence | Mémoire GPU (annoncé par WebLLM) | Français / arabe |
|---|---|---|---|---|
| **Qwen3 0.6B** q4f16 | WebLLM | Apache-2.0 | 1 403 Mo | Les deux annoncés (119 langues) ; qualité modeste attendue |
| **Qwen3 1.7B** q4f16 | WebLLM | Apache-2.0 | 2 037 Mo | Les deux ; meilleur en maths et raisonnement |
| Qwen2.5 1.5B Instruct q4f16 | WebLLM | Apache-2.0 | 1 630 Mo | Les deux (29+ langues annoncées) |
| Qwen2.5 0.5B Instruct Q4_K_M | wllama | Apache-2.0 | — (processeur) | Pour les téléphones sans WebGPU |
| Qwen3 0.6B Q8_0 | wllama | Apache-2.0 | — (processeur) | Pour les téléphones sans WebGPU |

**Écartés :** Llama 3.2 1B (licence Llama : usage commercial sous conditions, et l'arabe ne fait
pas partie des langues officiellement prises en charge) ; Gemma 2 2B (conditions d'utilisation
Gemma, pas une licence open source classique) ; Qwen2.5 3B (licence « Qwen Research », usage
commercial interdit) ; Phi-3.5 mini (3,7 Go de mémoire GPU, trop lourd pour un téléphone moyen).

**Mon choix de départ : Qwen3 1.7B** si le téléphone a WebGPU et au moins 4 Go de mémoire, sinon
**Qwen3 0.6B**. Sans WebGPU, Qwen2.5 0.5B sur wllama. Ce choix doit être confirmé par les
mesures de la page labo sur vos téléphones : je n'ai pas pu les mesurer moi-même (voir
`docs/resultats-tests.md`).

## Limites connues

- **HTTPS obligatoire pour installer l'application depuis le Wi-Fi** : Chrome n'active le mode
  hors ligne (service worker) que sur `https://` ou `localhost`. Le serveur crée donc un
  certificat d'école à installer **une fois** sur chaque téléphone (page `/installer`).
  Autre solution sans certificat : réglage `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
  avec l'adresse du serveur, ou installer une fois depuis un hébergement HTTPS public.
- **Lecture des feuilles** : une ombre franche qui coupe un des 4 carrés noirs empêche la lecture
  (la photo est refusée avec un message clair, jamais une note fausse). Une feuille photographiée
  à l'envers n'est pas détectée (pas de repère d'orientation).
- **40 questions et 6 cases par ligne** au maximum sur une feuille (zone imprimable A4).
- **Questions ouvertes** (calcul, démonstration, figure, rédaction) : le moteur de barème est prêt
  (étapes, erreur entraînée, « montrer que », méthode différente), mais la lecture automatique de
  l'écriture manuscrite n'existe pas encore (phase suivante). Aujourd'hui, l'enseignant noircit
  les points obtenus dans les cases de points de la feuille.
- **Traductions arabes** écrites par moi : à faire relire par un locuteur natif.
