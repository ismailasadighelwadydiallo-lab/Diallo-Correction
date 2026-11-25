# Packs du Bac mauritanien : vérification et relecture

Source : archive « Pack Bac Mauritanie » (corrigés et barèmes **proposés, non officiels**), reçue le 25/11/2026,
gardée telle quelle dans `packs/sources/pack-bac-mauritanie/`. Conversion au format `oc-pack/1` :
`node scripts/convertir-packs-bac.ts packs/sources/pack-bac-mauritanie packs`. Vérification : `npm run verifier-packs`.

## Résumé

| Pack | Questions | Points | Complet | Calculs vérifiés par le moteur | À relire |
|---|---|---|---|---|---|
| `bac-2025-normale-maths-M-TMGM.json` | 17 | 10,5 | non — Page 2/2 (≈ 9,5 pts) : la fin de l'exercice 3 (0,5 pt sur 4 non visible) et les exercices suivants | 41 | 2 |
| `bac-2026-complementaire-maths-SN-TSGE.json` | 14 | 8,5 | non — Page 2/2 (≈ 11,5 pts) | 23 | 1 |
| `bac-2026-complementaire-sciences-naturelles-SN.json` | 29 | 20 | oui | 0 | 3 |
| `bac-2026-complementaire-sciences-physiques-SN.json` | 16 | 10,5 | non — Page 2 (≈ 9,5 pts) | 0 | 3 |
| `bac-2026-normale-maths-M-TMGM.json` | 27 | 20 | oui | 78 | 1 |
| `bac-2026-normale-sciences-naturelles-SN.json` | 38 | 19,5 | non — L'exercice 1 est annoncé sur 6 pts mais ses questions totalisent 5,5 pts (sujet et corrigé proposé concordent) : total réel 19,5. À vérifier avec le barème officiel. | 0 | 7 |
| `bac-2026-normale-sciences-physiques-SN.json` | 36 | 20 | oui | 0 | 9 |

Les 142 vérifications des 3 packs de maths passent. Celles du pack Maths M & TMGM 2026 sont aussi testées
« à l'envers » (`packages/oc-core/test/packs-bac.test.ts`) : on fausse la valeur attendue et on vérifie que le
moteur la refuse. Les 4 packs de sciences n'ont pas encore de calcul vérifié par le moteur (le cahier des charges
demandait les mathématiques ; à faire ensuite pour la physique-chimie).

## Maths M & TMGM 2026 (pack demandé à l'étape 7)

Complet : 27 questions, 20 points, barème par étape repris du pack d'origine. **Aucune erreur trouvée** dans les réponses
mathématiques : 78 calculs refaits par math.js (matrices, nombres complexes, dérivées, limites, inégalités, sommes).

Ce que le moteur **ne peut pas** vérifier, à relire par un professeur :

- Ex1-2a (représentation paramétrique) et Ex1-2b (équivalence logique) : raisonnement, pas de calcul.
- Ex3-1 : figure, notée par grille de critères (confiance « moyenne » dans le pack d'origine).
- Les **limites** sont contrôlées numériquement (valeurs de plus en plus proches) : un indice fort, pas une preuve.
- Les **inégalités** (« vrai sur un domaine ») sont testées sur des points tirés au hasard, pas démontrées.
- Les **récurrences** et formules en n (Aⁿ, Xₙ) sont vérifiées pour plusieurs valeurs de n et pour l'hérédité, pas en général.
- Le **barème par étape** (répartition des points) vient du pack d'origine : il n'est pas le barème officiel.

## Ce que la conversion a changé

- `choix` (texte des propositions de QCM) : ajouté à l'énoncé ; les lettres deviennent les cases de la feuille.
- `regle_qcm: "plusieurs"` : la règle (tout ou rien / points partiels) est laissée au choix de l'enseignant.
- `valeurs` numériques : rattachées à l'étape dont le critère contient le nombre ; sinon gardées dans `controles` (texte).
- `synonymes` : rattachés à l'étape correspondante (réponses courtes acceptées).
- `confiance: moyenne / a_valider` et `note` : copiés dans `a_relire` (affiché dans l'application).
- Packs incomplets (pages manquantes) : le total est celui des points présents, l'épreuve complète est notée dans `meta.partiel`.
  Sciences naturelles normale : 19,5 pts (l'exercice 1 annoncé sur 6 pts ne totalise que 5,5).

## Liste complète des points à relire

### Bac 2025 session normale — Mathématiques — Séries M & TMGM (partiel : 10,5 pts)

- Ex2-2b : Confiance moyenne du corrigé proposé — Accepter aussi une seule valeur avec justification ; vérifier la consigne du barème officiel.
- Ex3-1 : Confiance moyenne du corrigé proposé

### Bac 2026 session complémentaire — Mathématiques — Séries SN & TSGE (partiel : 8,5 pts)

- Ex2-4 : Confiance moyenne du corrigé proposé

### Bac 2026 session complémentaire — Sciences naturelles — Série SN

- Ex1-1 : Confiance moyenne du corrigé proposé
- Ex3B-3 : Confiance moyenne du corrigé proposé
- Ex3B-4 : Confiance moyenne du corrigé proposé

### Bac 2026 session complémentaire — Sciences physiques — Série SN (partiel : 10,5 pts)

- Ex2-4 : La valeur finale de V_BE se lit sur le graphe du sujet : vérifier la lecture.
- Ex2-5 : Confiance moyenne du corrigé proposé
- Ex2-6 : Réponse à valider par un professeur.

### Bac 2026 session normale — Mathématiques — Séries M & TMGM

- Ex3-1 : Confiance moyenne du corrigé proposé — Figure dessinée : notation par grille de critères.

### Bac 2026 session normale — Sciences naturelles — Série SN (partiel : 19,5 pts)

- QCM-2 : Réponse à valider par un professeur.
- QROC-1 : Confiance moyenne du corrigé proposé — Légendes tirées du corrigé proposé ; la légende 2 (globule polaire ou zone pellucide) est à confirmer sur le schéma.
- QROC-2 : Confiance moyenne du corrigé proposé
- QROC-4b : Confiance moyenne du corrigé proposé — Accepter une date de fin de phase folliculaire (17-18 juin).
- Ex1B-5a : Confiance moyenne du corrigé proposé — Dépend du schéma du circuit (positions des oscilloscopes).
- Ex1B-7 : Le corrigé proposé donne 20 ms ; accepter 20 ou 20,5 ms selon le barème officiel.
- Barème : L'exercice 1 est annoncé sur 6 pts mais ses questions totalisent 5,5 pts (sujet et corrigé proposé concordent) : total réel 19,5. À vérifier avec le barème officiel.

### Bac 2026 session normale — Sciences physiques — Série SN

- Ex2-1 : Confiance moyenne du corrigé proposé — Concentrations lues sur une photo : vérifier C₁ et C₂ sur le sujet papier.
- Ex2-2.3 : Valeur dépendant de la lecture graphique : tolérance large.
- Ex2-3 : Confiance moyenne du corrigé proposé
- Ex2-4 : Confiance moyenne du corrigé proposé
- Ex3-2.1 : Confiance moyenne du corrigé proposé
- Ex3-4 : Confiance moyenne du corrigé proposé
- Ex4-1.3.1 : Confiance moyenne du corrigé proposé
- Ex4-1.3.2 : Confiance moyenne du corrigé proposé — Ep₀ et Ec₀ sont lus sur la figure 2 du sujet.
- Ex4-2.2 : Confiance moyenne du corrigé proposé — Le sens dépend de la figure 3 du sujet.
