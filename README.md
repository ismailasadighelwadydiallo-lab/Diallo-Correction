# Diallo Correction

**OFFLINE FIRST. AI LOCAL FIRST. CLOUD OPTIONAL.**
Si Internet disparaît, l'application reste utile. Si Internet revient, elle devient plus puissante.

Correction automatique de copies photographiées, **en mode avion**, dans tout navigateur récent :
Chrome, Edge, Firefox, Safari, sur téléphone Android, iPhone, iPad ou ordinateur
(détail et limites par navigateur : `docs/navigateurs.md`).
Note sur 20, points partiels par étape, explication de chaque point retiré, indice de confiance,
copies douteuses signalées sans rien bloquer. Interface en français et en arabe.

## Ce qui marche aujourd'hui

- **Feuilles-réponses à cases** (QCM à une ou plusieurs bonnes réponses, et cases de points
  pour les questions notées par le professeur) : impression, photo, lecture, note immédiate.
- **Moteur de barème** (`oc-core`) : QCM, numérique (tolérance, unités), texte court (accents,
  majuscules, synonymes, arabe), étapes, erreur entraînée, « montrer que », méthode différente
  vérifiée par le calcul, grilles de critères pour les figures, pas de 0,25 pt.
- **PWA hors ligne** : épreuves, correction en série (caméra ou galerie), copie corrigée,
  modification d'une note avec journal, résultats de classe (moyenne, médiane, réussite par
  exercice), export CSV, sauvegarde dans un fichier.
- **Assistant du correcteur, hors ligne** (calculs sur l'appareil, aucun appel réseau) :
  - **📘 Résoudre une épreuve** : corrigé complet question par question (ce qui est demandé,
    données, méthode, calcul, résultat, vérification, barème, confiance en 4 catégories), bilan
    « résolues / à vérifier » (rien n'est caché), export en fichier lisible, impression, et
    « Utiliser pour corriger les copies » avec le même pack ;
  - **Importer le sujet** : photo, scan ou PDF. Le texte est lu sur le téléphone (texte du
    PDF, ou OCR français / arabe pour les photos et les PDF scannés), découpé en exercices et
    questions, corrigé par l'enseignant, puis résolu. La lecture des photos se télécharge une
    fois (≈ 5 à 6 Mo) avec le bouton « Préparer la lecture hors ligne ». Word : pas encore
    (enregistrer en PDF) ;
  - **🧠 Je bloque** : solution complète, méthode seule, étape par étape, autre méthode, ou
    vérifier son raisonnement ; plus une question de maths libre (équations, dérivées, limites,
    développer, factoriser, calculs) ;
  - **🔍 Vérifier mon raisonnement** : chaque ligne est marquée juste, erreur, erreur entraînée
    ou non lue.
  Barème toujours étiqueté **officiel** ou **proposé — non officiel**. Critères de confiance :
  `docs/confiance.md`.
- **Page labo** pour mesurer l'IA locale sur votre téléphone.
- **Serveur local de l'école** : sert l'application et les packs sur le Wi-Fi, sans Internet.
- **7 packs du Bac mauritanien** (2025-2026) dans `packs/`, dont **Maths M & TMGM 2026 complet**,
  avec 142 calculs vérifiés par le moteur. Ce qui reste à relire : `docs/packs-bac-relecture.md`.

Ce qui manque encore : voir `docs/resultats-tests.md` (section « Pas encore mesuré ») et
`docs/choix.md` (section « Limites connues »).

## Organisation

```
offline-correction/
├── packages/
│   ├── oc-core/     Moteur sans interface (navigateur ET Node) : packs, notation, maths, lecture des feuilles
│   ├── oc-web/      La PWA (+ page labo IA)
│   ├── oc-server/   Serveur local de l'école (Fastify)
│   └── oc-api/      Cloud optionnel : seulement un README pour l'instant
├── packs/           Packs d'épreuves (JSON) + schéma oc-pack.schema.json
├── fixtures/        Photos simulées de feuilles pour les tests
├── scripts/         Génération des fixtures, vérification des packs
└── docs/            Choix techniques et licences, architecture, résultats des tests
```

## Installer et lancer (sur un PC)

Il faut **Node.js 22.18 ou plus récent** (https://nodejs.org, version LTS).

```bash
npm install              # une fois, avec Internet
npm test                 # tests automatiques (78 tests)
npm run build            # construit l'application dans packages/oc-web/dist
npm run serveur          # lance le serveur local (construit d'abord l'application)
```

Pour développer l'interface : `npm run dev -w oc-web` puis ouvrir http://localhost:5173.

### Test « mode avion »

```bash
npm run test:avion
```

Ce test (Playwright) ouvre l'application, **coupe le réseau**, importe un pack, corrige deux
photos simulées, vérifie les notes, modifie une note, exporte le CSV, passe en arabe, et vérifie
qu'**aucune requête** ne part vers Internet. Il teste aussi la page labo, le serveur local et
l'aide à l'installation, sur Chrome Android et Chrome ordinateur.

### Tous les navigateurs

```bash
npx playwright install --with-deps chromium firefox webkit msedge   # une fois, avec Internet
npm run test:navigateurs      # Chrome Android/PC, Edge, Firefox PC/mobile, Safari iPhone/iPad/Mac
npm run test:webkit           # moteur de Safari (WebKitGTK), serveur réellement arrêté
```

`test:webkit` demande, sous Linux : `sudo apt install webkit2gtk-driver xvfb`. Sur GitHub, ces tests
tournent tout seuls à chaque envoi (`.github/workflows/navigateurs.yml`).

### Autres commandes

| Commande | Rôle |
|---|---|
| `npm run typecheck` | Vérification des types TypeScript |
| `npm run fixtures` | Régénère le pack de démonstration et les photos simulées |
| `npm run verifier-packs` | Valide tous les packs de `packs/` et vérifie leurs calculs avec math.js |
| `node scripts/convertir-packs-bac.ts <dossier> packs` | Convertit des packs préparés ailleurs (format « Pack Bac Mauritanie ») au format `oc-pack/1` |

## Installer l'application sur les téléphones de l'école (sans Internet)

1. Sur le PC de l'école, branché au Wi-Fi (un simple routeur suffit, **sans Internet**) :
   `npm run serveur`. Le serveur affiche ses adresses, par exemple `http://192.168.1.10:8080/installer`.
2. Sur chaque appareil, connecté au même Wi-Fi, ouvrez cette adresse **/installer** et suivez les
   étapes de votre appareil (la page explique Android, iPhone/iPad et ordinateur). Sur Android :
   - télécharger le **certificat de l'école** et l'installer (une seule fois : Paramètres →
     Sécurité → Chiffrement et identifiants → Installer un certificat → Certificat CA) ;
   - ouvrir `https://192.168.1.10:8443/` ;
   - menu ⋮ → **Installer l'application**.
3. Ouvrez l'application une fois : le message « Prête pour le mode avion » apparaît.
   Ensuite, elle fonctionne sans Wi-Fi et sans Internet.

Sur iPhone/iPad, le certificat s'installe depuis Safari (Réglages → Général → VPN et gestion de
l'appareil, puis Informations → Réglages des certificats), puis Partager ⬆️ → « Sur l'écran d'accueil ».

Pourquoi un certificat ? Les navigateurs n'activent le mode hors ligne que sur une adresse `https://`.
Le serveur fabrique lui-même ce certificat (dossier `packages/oc-server/certs/`, à ne pas
partager : il contient la clé privée). **Méthode sans certificat** (un téléphone de test) :
dans Chrome, ouvrir `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, y mettre
`http://192.168.1.10:8080`, activer, relancer Chrome.

Les packs placés dans le dossier `packs/` du serveur apparaissent dans l'application
(Mes épreuves → « Packs du serveur de l'école ») quand le téléphone est sur le Wi-Fi.

Variables du serveur : `OC_PORT_HTTPS` (8443), `OC_PORT_HTTP` (8080), `OC_NOM` (nom affiché),
`OC_PACKS` (dossier des packs), `OC_MODELES` (dossier des modèles d'IA), `OC_HTTP_SEUL=1`.

## Utiliser l'application

0. **Résoudre une épreuve** → **Importer le sujet** (photo, scan, PDF) ou choisir une épreuve : corrigé complet, questions à vérifier,
   export ; **Je bloque** et **Vérifier mon raisonnement** sont aussi sur l'accueil.
1. **Mes épreuves** → importer un pack (`.json`) ou **créer un QCM**.
2. **Feuille-réponse** → imprimer, photocopier pour les élèves.
3. Pour les questions ouvertes, le professeur noircit les points obtenus dans les cases `*`.
4. **Corriger des copies** → photographier chaque feuille, ou en importer plusieurs depuis la
   galerie. Chaque copie est notée et enregistrée tout de suite ; ⚠️ = à revoir.
5. **Copie corrigée** → note, points par question, explications, confiance ; bouton « Modifier »
   pour changer une note (la modification et son motif sont enregistrés).
6. **Résultats** → moyenne, médiane, réussite par exercice et par question, export Excel/CSV.
7. **Sauvegarde** → toutes les données dans un fichier, à garder sur une clé USB ou le PC.

## Format des packs

Voir `packs/oc-pack.schema.json` (schéma JSON) et `packs/demo-devoir-qcm.json`. Exemple :

```json
{
  "format": "oc-pack/1",
  "id": "bac-2026-normale-maths-M-TMGM",
  "titre": "Bac 2026 — Mathématiques — M & TMGM",
  "total": 1.25, "langue": "fr",
  "regles": { "qcm_multi": "partiel", "qcm_negatif": false },
  "questions": [
    { "id": "Ex1-Q1", "type": "qcm", "enonce": "…", "points": 0.5, "choix": ["A","B","C"], "bonnes": ["B"] },
    { "id": "Ex2-Q2", "type": "calcul", "enonce": "Déterminer f'(x)…", "points": 0.75,
      "verification": { "moteur": "math", "expression": "diff(x*exp(2-x), x)", "egal_a": "(1-x)*exp(2-x)" },
      "etapes": [
        { "id": "derivee", "critere": "Dérivée juste", "points": 0.5, "nature": "calcul", "attendu": "(1-x)*exp(2-x)", "variable": "fp" },
        { "id": "tableau", "critere": "Tableau de variation juste", "points": 0.25, "nature": "resultat" }
      ] }
  ]
}
```

Types : `qcm`, `numerique`, `texte_court`, `calcul`, `demonstration`, `figure`, `redaction`.
Vérifications possibles (`verification`, une ou une liste) : `egal` (expressions, nombres complexes,
matrices, `diff(f, x, n)`), `racines`, `primitive`, `limite` (contrôle numérique) et `vrai` (inégalité
sur un domaine). Une étape peut avoir des `reponses` (réponse courte avec synonymes).
Une étape avec `attendu` et `variable` permet l'**erreur entraînée** : une étape suivante qui
utilise cette variable et reste cohérente avec la valeur (fausse) de l'élève garde ses points.

## Licences

Détail complet, avec usage commercial et alternatives : `docs/licences.md`.

Toutes les dépendances autorisent l'usage commercial (MIT, Apache-2.0, BSD, ISC, 0BSD,
BlueOak). Détail et tailles : `docs/choix.md`. Modèles d'IA proposés : Qwen3 et Qwen2.5
(Apache-2.0).

## Règles du projet

- Aucun faux mode hors ligne : rien n'appelle Internet en cachette. La seule fonction qui peut
  utiliser Internet est le **premier téléchargement d'un modèle** dans la page labo, marqué
  « Internet requis » et lancé par un bouton.
- Les données restent sur l'appareil. Aucun envoi vers le cloud sans accord explicite.
- Pas de chiffres inventés : les mesures sont dans `docs/resultats-tests.md`, avec leur méthode.
