# Résultats des tests et mesures

Mesures du 25/11/2026, sur le serveur de développement (Intel Xeon 2,1 GHz, 4 cœurs, Linux,
Node 22.23, Chromium de Playwright 1.63). **Ce ne sont pas des mesures sur téléphone.**
Les chiffres « téléphone » ci-dessous sont des **estimations** obtenues en ralentissant le
processeur du navigateur (émulation Chrome DevTools), à remplacer par des mesures réelles.

## Tests automatiques

| Suite | Commande | Résultat |
|---|---|---|
| oc-core, oc-server (Vitest) | `npm test` | **58 tests, tous passent** |
| PWA en mode avion, labo, serveur (Playwright) | `npm run test:avion` | **4 tests, tous passent** |

Détail Vitest : 5 tests moteur mathématique, 6 tests format des packs, 27 tests règles de
barème (une ou plusieurs par règle de la section 7), 15 tests lecture des feuilles, 5 tests serveur.

### Lecture des feuilles simulées (30 questions : QCM simples, QCM multiples, cases de points)

| Cas simulé | Résultat |
|---|---|
| Feuille droite, bonne lumière | toutes les cases bien lues |
| Photo inclinée (perspective + rotation) | toutes bien lues |
| Ombre de la main sur la moitié des cases (bord flou) | toutes bien lues |
| Ombre franche (sans flou) en travers des cases | toutes bien lues |
| Éclairage inégal (100 % → 55 %) et bruit fort | toutes bien lues |
| Petite photo (600 px de haut) | toutes bien lues |
| Crayon pâle (gris 160 sur papier 235), case remplie à 70 % | toutes bien lues |
| Case vide | lue « vide », 0 point |
| Deux cases cochées sur un QCM à une réponse | lue « plusieurs cases », 0 point, copie signalée ⚠️ |
| QCM à plusieurs réponses (A et D) | les deux lues |
| Ombre franche qui coupe un carré noir | photo refusée avec un message clair (limite connue) |

Amélioration par rapport à `correcteur.html` : la noirceur de chaque case est maintenant
comparée au papier **juste autour d'elle**, et le seuil s'abaisse pour le crayon pâle. Sans
cela, les cases blanches dans l'ombre étaient lues comme cochées (constaté pendant les tests).

### Test « mode avion » (Playwright, réseau coupé, Pixel 7 émulé)

Première visite avec réseau, puis réseau coupé et rechargement. L'application s'ouvre, importe
le pack de démonstration, corrige 2 photos simulées (16/20 et 15/20, la double case est
signalée), l'enseignant modifie une note (17/20, motif enregistré), les résultats affichent
moyenne et médiane, l'export CSV fonctionne, l'interface passe en arabe (droite à gauche).
**Aucune requête vers une autre adresse que l'application pendant tout le test.**

Test serveur : le téléphone émulé ouvre l'application en HTTPS sur l'adresse Wi-Fi du serveur,
voit 🟣 Serveur local, installe le service worker, importe un pack du serveur ; ensuite, réseau
coupé, l'application et le pack restent disponibles (🟢).

## Mesures

| Mesure | Valeur | Comment |
|---|---|---|
| Taille de l'application installée (précache) | 972 Ko | build Vite |
| Code principal (main.js) | 928 Ko (287 Ko compressé) | build Vite ; surtout math.js et Ajv |
| Lecture d'une feuille 900×1250 (Node) | 32 ms | moyenne de 10 lectures |
| Lecture d'une feuille 1008×1400 (Node) | 38 ms | idem |
| Notation d'une copie | 0,05 ms | moyenne de 100 |
| Ouverture de l'application (PC) | 176 ms | Chromium, Pixel 7 émulé |
| Correction d'une photo dans la PWA (PC) | 77 ms par copie | 4 photos importées d'un coup |
| Ouverture, processeur ralenti ×4 | 423 ms | **estimation** téléphone moyen |
| Correction d'une photo, processeur ralenti ×4 | 318 ms par copie | **estimation** |
| Correction d'une photo, processeur ralenti ×6 | 379 ms par copie | **estimation** téléphone d'entrée de gamme |

## Pas encore mesuré

- **IA locale** : aucune mesure. Hugging Face est bloqué depuis mon environnement et je n'ai
  ni téléphone ni GPU. La page labo produit ce rapport sur votre téléphone.
- **Vraies photos** de copies : les tests utilisent des photos simulées. Il faut un lot de
  vraies photos (anonymisées) dans `fixtures/` pour mesurer la précision réelle.
- **Installation réelle sur Chrome Android** depuis le serveur de l'école (certificat compris).
