# Architecture

```
          Téléphone, tablette, PC (tout navigateur)             PC de l'école (Wi-Fi sans Internet)
 ┌──────────────────────────────────────────────┐          ┌─────────────────────────────────┐
 │ oc-web (PWA)                                 │  HTTPS   │ oc-server (Fastify)             │
 │  écrans · caméra · IndexedDB (Dexie)         │◄────────►│  /           la PWA construite  │
 │  service worker (précache de tout)           │  Wi-Fi   │  /api/info   « serveur local »  │
 │        │                                     │ (option) │  /api/packs  liste des packs    │
 │        ▼                                     │          │  /packs/     fichiers .json     │
 │ oc-core  ── même code ──────────────────────────────────►│  /modeles/   modèles d'IA       │
 │  pack/     schéma + validation               │          │  /installer  /ca.crt            │
 │  grading/  barème, erreur entraînée, conf.   │          └─────────────────────────────────┘
 │  math/     math.js : dérivées, équivalences  │
 │  sheet/    repères, homographie, cases       │          oc-api (plus tard, optionnel) :
 │ page labo : WebLLM / wllama (chargés à part) │          corrigés préparés en ligne → packs
 └──────────────────────────────────────────────┘
```

## Chemin d'une copie

1. Photo (caméra ou galerie) → réduite à 1400 px → niveaux de gris (`image.ts`).
2. `readSheet` (oc-core) : seuil adaptatif, 4 repères, homographie, noirceur de chaque case
   comparée au papier autour, seuil abaissé pour le crayon pâle, confiance par ligne.
3. `copieDepuisLecture` : lettres cochées (QCM) ou points noircis (questions ouvertes).
4. `noterCopie` : points par étape, explications, confiance (lecture × notation), copie
   signalée si une ligne est douteuse.
5. Enregistrement immédiat dans IndexedDB avec la photo réduite (pas de validation obligatoire).
6. `modifierNote` : l'enseignant change une note ; la note automatique et le motif sont gardés.

## Indice de confiance

- **Lecture** (0 à 1) : distance de chaque case au seuil de noirceur. Une case ni vraiment
  blanche ni vraiment noire fait baisser la confiance ; sous 0,5 la ligne est « incertaine ».
- **Notation** (0 à 1) : 1 pour un QCM ou un calcul vérifié par math.js ; 0,9 pour une erreur
  entraînée ; 0,85 pour un texte court non reconnu (synonyme possible) ; 0,75 pour une méthode
  différente ; 0,6 pour un jugement venu d'une IA ou une valeur proche de la tolérance.
- Une copie est **signalée** si une confiance passe sous 0,7 (`regles.seuil_confiance`), ou
  si deux cases sont cochées sur un QCM à une réponse. Rien n'est bloqué.

## Pourquoi pas de compilation pour Node

Node 22.18+ exécute directement les fichiers `.ts` (suppression des types). Le code utilise
donc uniquement une syntaxe TypeScript « effaçable » (`erasableSyntaxOnly`) et des imports
avec l'extension `.ts`. Le même fichier tourne dans Vitest, dans Vite (navigateur) et dans Node.
