# Confiance : critères fixes

L'application n'affiche **jamais de pourcentage inventé**. Chaque question du corrigé a
**quatre confiances séparées**, avec des critères écrits ici et testés
(`packages/oc-core/test/solution.test.ts`).

| Catégorie | 🟢 élevée | 🟡 moyenne | 🟠 faible | 🔴 aucune |
|---|---|---|---|---|
| **Lecture** (du sujet ou de la copie) | — | — | — | « sans objet » quand le sujet vient d'un pack (rien n'a été lu sur une photo) |
| **Compréhension** | Question structurée dans un pack (énoncé, type, points) | Question libre reconnue par le solveur | — | Demande non reconnue |
| **Résolution** | Résultat exact **et** confirmé par un contrôle indépendant (substitution des racines, différence finie pour une dérivée, calcul vérifié du pack) | Corrigé du pack sans calcul vérifiable, ou résultat approché (limite estimée numériquement) | Un contrôle a échoué, ou la question est marquée « à relire par un professeur » | Aucun corrigé et le solveur ne sait pas traiter : « ⚠️ Information insuffisante » |
| **Notation** | Barème **officiel** fourni | Barème proposé (non officiel) ou d'origine inconnue | Pas de barème détaillé par étape pour une question ouverte | — |

## Statut affiché

- **✓ Résolu** : résolution élevée ou moyenne.
- **⚠️ Vérification recommandée** : résolution faible.
- **⚠️ Information insuffisante** : aucune résolution.

Les questions à vérifier sont **comptées dans le bilan** et **jamais cachées** : le filtre
« Voir seulement les questions à vérifier » les isole, il ne retire rien.

## Barème

- `bareme_source: "officiel"` seulement si le barème vient d'un document officiel.
- `bareme_source: "propose"` : affiché « Barème proposé — non officiel ».
- Absent : affiché « Origine du barème inconnue — à considérer comme non officiel ».

Les 7 packs du Bac actuels sont tous `propose`.

## Vérifier mon raisonnement

Chaque ligne reçoit un statut : **juste**, **erreur**, **erreur entraînée** (cohérente avec une
erreur précédente), **non lue** (phrase que le moteur ne sait pas vérifier : elle n'est jamais
comptée juste), **info**. Le moteur ne vérifie que des calculs d'une variable.
