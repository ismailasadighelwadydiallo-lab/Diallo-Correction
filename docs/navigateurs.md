# Navigateurs pris en charge

Offline Correction est une application web : elle marche dans **tout navigateur récent**, sur
téléphone, tablette ou ordinateur, sans rien installer de spécial. Les navigateurs utilisent en
réalité **trois moteurs** ; c'est le moteur qui compte pour savoir si l'application marche :

| Moteur | Navigateurs |
|---|---|
| **Chromium** | Chrome (Android, Windows, Mac, Linux), Edge, Samsung Internet, Opera, Brave |
| **WebKit** | Safari (iPhone, iPad, Mac) **et tous les navigateurs sur iPhone/iPad** (Chrome, Firefox, Edge sur iPhone utilisent WebKit, imposé par Apple) |
| **Gecko** | Firefox (Android, Windows, Mac, Linux) |

**Versions minimales** : navigateurs de 2021 ou plus récents — Chrome/Edge 88, Firefox 78,
Safari 14 (iOS 14). C'est la cible de compilation de l'application (`es2020`).

## Ce qui a été testé, et comment

| Navigateur | Testé où | Résultat |
|---|---|---|
| Chrome Android (Pixel 7 émulé) | ici, Playwright 1.63, Chromium | **tous les tests passent** : mode avion, correction, export, arabe, serveur de l'école, labo, aide à l'installation |
| Chrome ordinateur | ici, Playwright 1.63, Chromium | **tous les tests passent** (sauf le test serveur, lancé une seule fois) |
| Moteur de Safari (WebKit) | ici, **WebKitGTK 2.52.6** piloté par WebDriver, **serveur réellement arrêté** | **13 étapes sur 13 (assistant compris)** : voir ci-dessous. Un vrai bogue Safari a été trouvé et corrigé. |
| Firefox ordinateur et écran de téléphone | GitHub, Playwright 1.63 (26/11/2026) | **tous les tests passent** |
| Safari iPhone, iPad, Mac (WebKit de Playwright) | GitHub, Playwright 1.63 (26/11/2026) | **tous les tests passent** |
| Edge ordinateur | GitHub, Playwright 1.63 (26/11/2026) | **tous les tests passent** |
| Moteur de Safari (WebKitGTK 2.52.6) | GitHub aussi | **13 étapes sur 13** |
| Vrais téléphones (Android, iPhone) | **pas encore** | à faire sur le terrain |

La **vérification automatique GitHub** (`.github/workflows/navigateurs.yml`) installe Chromium,
Firefox, WebKit et Edge et lance tous les tests à chaque envoi de code. Premier passage complet
le 26/11/2026 : **41 tests Playwright passent sur 8 profils de navigateur** (7 ignorés : le test du
serveur de l'école ne tourne qu'une fois), 78 tests Vitest, 12 étapes WebKitGTK.
Dernier passage (26/11/2026, avec l'assistant du correcteur) : **49 tests Playwright passent** sur 8 profils
(7 ignorés), 96 tests Vitest, 13 étapes WebKitGTK.

Pour WebKit, le mode avion des tests arrête vraiment le serveur au lieu d'utiliser la coupure
réseau de Playwright : celle-ci empêche aussi le service worker de répondre (« WebKit encountered
an internal error »), ce que Safari ne fait pas.

### Test WebKit (moteur de Safari) en mode avion réel

`npm run test:webkit` (Linux, il faut `sudo apt install webkit2gtk-driver xvfb`). Après la
première visite, le serveur de l'application est **arrêté** : tout vient ensuite du service
worker et de la base locale du navigateur.

1. Première visite : le service worker installe l'application.
2. Serveur arrêté, rechargement : l'application s'ouvre (🟢 Hors ligne).
3. Import d'un pack.
4. Correction de 2 photos : 16/20 et 15/20, la double case est signalée ⚠️.
5. L'enseignant modifie une note : 17/20.
6. Résultats de la classe, export CSV (contient la note modifiée).
7. Pack réel du Bac (Maths M & TMGM 2026) : import et feuille-réponse.
8. Interface en arabe, de droite à gauche.
9. Aide à l'installation affichée puis fermée.
10. Page labo hors ligne : WebGPU absent → modèles WebGPU grisés, modèle wllama choisi d'office,
    message clair quand le modèle n'est pas disponible.
11. Sauvegarde complète (photos comprises), base vidée, restauration.
12. Photo d'une copie restaurée affichée.

Durée : 5,1 s pour les 13 étapes sur le serveur de développement.

**Bogue trouvé grâce à ce test, et corrigé** : WebKit refusait d'enregistrer la photo des copies
(`Error preparing Blob/File data to be stored in object store`). Résultat sur Safari avant la
correction : **aucune copie ne pouvait être corrigée**. Les photos sont maintenant enregistrées
sous une autre forme (ArrayBuffer), acceptée par tous les navigateurs ; les copies déjà
enregistrées sur Chrome restent lisibles.

WebKitGTK n'est pas Safari : c'est le même moteur (rendu, JavaScript, service worker, base de
données), mais pas les mêmes règles de stockage ni la même interface caméra que sur iPhone.

## Ce qui change d'un navigateur à l'autre

| | Chrome / Edge (Android, PC) | Safari iPhone / iPad | Safari Mac | Firefox Android | Firefox PC |
|---|---|---|---|---|---|
| Mode avion (service worker) | ✅ | ✅ | ✅ | ✅ (testé en écran de téléphone sur Firefox PC) | ✅ |
| Installer l'application | ✅ bouton « Installer » dans l'application | geste à faire : Partager ⬆️ → « Sur l'écran d'accueil » (expliqué dans l'application) | Fichier → « Ajouter au Dock » (Safari 17+) | menu ⋮ → « Installer » | ❌ pas d'installation : favori. **Le mode avion marche quand même.** |
| Données gardées | oui ; stockage persistant demandé | **effacées après 7 jours sans ouvrir l'application si elle n'est pas sur l'écran d'accueil** (règle de Safari) → l'application le dit | comme iPhone si non ajoutée au Dock | oui | oui |
| Photo avec l'appareil photo | ✅ | ✅ | choix d'un fichier | ✅ | choix d'un fichier |
| IA locale rapide (WebGPU) | ✅ Chrome/Edge 113+ (selon le téléphone) | annoncé par Apple pour Safari 26 ; **non vérifié** | idem | ❌ | Windows seulement (annoncé pour Firefox 141) ; **non vérifié** |
| IA locale sans WebGPU (wllama) | ✅ | repli automatique ; **non mesuré** (mémoire limitée des onglets sur iPhone) | repli automatique | repli automatique | repli automatique |

## Replis mis en place

- **Installation** : sur Chrome/Edge, un bouton « Installer » apparaît sur l'accueil. Sur Safari
  et Firefox, où aucun bouton n'est possible, l'application explique le geste à faire. L'aide se
  ferme (« Plus tard ») et ne revient pas.
- **Stockage** : l'application demande au navigateur de garder les données. S'il refuse, un
  message conseille de faire des sauvegardes (💾). Sur iPhone, l'aide rappelle d'ajouter
  l'application à l'écran d'accueil pour éviter l'effacement après 7 jours.
- **IA locale** : la page labo détecte WebGPU. Sans WebGPU, les modèles WebLLM sont grisés et un
  modèle wllama (processeur) est choisi d'office.
- **Lecture des photos** : `createImageBitmap` si le navigateur le permet, sinon décodage par
  une image classique (anciens Safari).
- **Copier le rapport du labo** : presse-papiers, sinon sélection du texte.

## Limites restantes (honnêtement)

- **Les tests tournent sur des navigateurs émulés** : le WebKit de Playwright et WebKitGTK sont le
  moteur de Safari, pas Safari sur un vrai iPhone ; Firefox Android n'est pas émulable (écran de
  téléphone sur Firefox PC seulement).
- **Aucun vrai téléphone** testé à ce jour, ni Android ni iPhone.
- **Installation depuis le serveur de l'école sur iPhone** : il faut installer le certificat de
  l'école (Réglages → Général → VPN et gestion de l'appareil, puis Réglages → Général → Informations
  → Réglages des certificats → activer la confiance). Pas encore essayé sur un iPhone.
- **IA locale sur iPhone** : rien de mesuré. Les onglets Safari ont peu de mémoire : seuls les
  plus petits modèles ont une chance de tenir.
- Navigateurs très anciens (avant 2021), KaiOS, Opera Mini : non pris en charge.
