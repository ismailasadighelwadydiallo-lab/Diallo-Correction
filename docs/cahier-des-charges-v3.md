# Cahier des charges — version 3 (porteur du projet, 26/11/2026, deuxième envoi)

Résumé fidèle du « Master prompt v3 » envoyé par le porteur. Il complète, sans les remplacer,
les règles du prompt de départ (aucun faux hors ligne, aucun chiffre inventé, tout testé,
licences commerciales, un commit par étape, README en français).

## Mission

Un **assistant de correction éducative hors ligne**, pas un chatbot. Il doit :

1. analyser une épreuve ;
2. la résoudre de A à Z ;
3. produire un corrigé de référence détaillé ;
4. aider le correcteur quand il bloque ;
5. corriger les copies ;
6. appliquer le barème ;
7. signaler les cas incertains ;
8. tout faire sans Internet quand c'est possible localement.

L'ordre de priorité est **LOCAL → SERVEUR LOCAL → CLOUD**. Une fonction cloud est marquée
« 🔵 Fonction Cloud — Internet requis ».

## Deux modes, un seul moteur

- **Mode A, assistant du correcteur** : sujet → analyse → exercices et questions → barème →
  résolution → vérification → corrigé de référence.
- **Mode B, correction des copies** : corrigé et barème → copie → lecture → notation →
  explication → note.

Les deux modes partagent les mêmes questions, réponses attendues, critères, barème,
vérifications, méthodes acceptées et règles de notation. C'est le pack `oc-pack/1`, enrichi.

## Fonctions demandées

- **Import d'une épreuve** : caméra, galerie, PDF, Word/DOCX, images, plusieurs pages, pack.
  Aucun terme technique ne doit être visible (OCR, IA, JSON, WebGPU…).
- **Analyse automatique** : matière, niveau, examen, série, année, durée, exercices, questions,
  points, formules, données, tableaux, figures, unités. Le résultat est affiché.
- **Résolution** : toute l'épreuve, un exercice, une question, ou une étape à expliquer. Pour
  chaque question : compréhension, données, méthode, développement, calcul, vérification,
  réponse finale, barème proposé, confiance.
- **Vérification locale** des solutions (math.js, symbolique, numérique, substitution, unités),
  pas seulement un modèle de langue.
- **Plusieurs méthodes** : une autre méthode juste reçoit les points.
- **Corrigé de référence** en arbre Épreuve → Exercice → Question, chaque question ouvrable seule.
- **« 🆘 Je bloque »** : voir la solution, voir la méthode seule, expliquer étape par étape, autre
  méthode, vérifier mon raisonnement.
- **« Vérifier mon raisonnement »** : le correcteur tape sa démarche ; réponse étape par étape
  (✓ / ⚠️ erreur à l'étape n / résultat attendu).
- **Correction des copies** : pages détectées et remises dans l'ordre, copie identifiée, réponses
  lues, barème appliqué, retraits expliqués, confiance affichée.
- **Confiance séparée** : lecture, compréhension, résolution, notation. Jamais inventée : calculée
  à partir de critères documentés.
- **Cas incertain** : plusieurs lectures possibles affichées, aucun choix arbitraire. Ne jamais
  inventer la réponse de l'élève.
- **Page « Corrigé complet »** : état par exercice (✓ résolu / ⚠️ vérification recommandée),
  ouvrir, exporter (PDF, impression, pack), utiliser pour corriger.
- **Accueil** : 📚 Résoudre une épreuve · 📝 Corriger des copies · 📖 Mes épreuves.
- **Pédagogie** : toujours méthode → calcul → donc → réponse, jamais un résultat seul.

## Correction automatique : progression

1. QCM et cases
2. réponses numériques
3. calculs structurés
4. texte imprimé
5. manuscrit court
6. maths manuscrites
7. physique et chimie
8. figures
9. copies entièrement manuscrites

À chaque niveau : mesurer, tester, documenter.

## Phases

1. Stabiliser l'existant (tests, PWA, hors ligne, packs, barème).
2. Assistant d'épreuve : « Résoudre l'épreuve ».
3. Assistant « Je bloque ».
4. Relier le corrigé de référence à la correction des copies.
5. OCR (sujets, copies, imprimé, manuscrit court).
6. IA locale avancée.

## Tests demandés pour la nouvelle fonction

1. Une épreuve simple importée : toutes les questions sont identifiées.
2. Une équation résolue : solution vérifiée.
3. Un exercice complet : chaque sous-question a une solution.
4. Une question difficile : explication détaillée.
5. Une méthode alternative valide est acceptée.
6. Un résultat incertain : vérification humaine demandée.
7. En mode avion, le corrigé préparé reste accessible.
8. Une copie est corrigée avec le même barème que le corrigé de référence.

## Ne jamais promettre

- 100 % des copies corrigées parfaitement.
- Toute écriture manuscrite comprise.
- Le même modèle sur tous les téléphones.
- « Solution correcte » sans vérification quand elle est possible.

## Rapport après chaque étape

Ce qui fonctionne, ce qui ne fonctionne pas, ce qui n'a pas été testé, les mesures (appareil,
navigateur, taille du modèle, temps, précision, conditions), les problèmes rencontrés et la
prochaine étape.

## Ajouts du deuxième envoi (remplace le premier là où ils diffèrent)

- **Objectif** : tous les examens officiels du Bac mauritanien (toutes séries, matières, types de
  réponses), puis le BEPC et les devoirs. La fiabilité passe avant le nombre de fonctions.
- **Catalogue des épreuves** (Bac → série → matière → session/année → sujet/barème), enrichi
  sans toucher au moteur. Aucune série ni matière inventée : seulement ce qui est vérifié.
- **Moteurs par matière** dans `oc-core` : mathématiques, physique-chimie (unités, cohérence
  dimensionnelle), sciences naturelles, français, arabe, anglais, philosophie, histoire,
  géographie, éducation islamique, technique, autre. Chacun a ses règles. Un nouveau domaine =
  pack + moteur + règles de notation + règles de vérification + tests.
- **Rédactions et réponses ouvertes** : notation par critères (pertinence, structure,
  raisonnement), jamais « différent du corrigé = faux ».
- **Détection automatique** (matière, série, session, année, langue, type) avec une confiance
  affichée, jamais certaine, toujours modifiable à la main.
- **Barème officiel ou proposé** (`bareme_source`) : « Barème officiel fourni » ou « Barème
  proposé par le système — non officiel ». Interdit de présenter un barème proposé comme officiel.
- **Confiance** : lecture, compréhension, résolution et notation séparées. Catégories élevée,
  moyenne ou faible tant qu'aucune mesure statistique n'existe : pas de faux pourcentage.
- **Types de questions** : qcm, qcm_multiple, numerique, texte_court, calcul, demonstration,
  figure, graphique, tableau, redaction, analyse_document, question_ouverte, raisonnement,
  traduction, grammaire. La liste doit pouvoir s'étendre.
- **Accueil** : 📘 Résoudre une épreuve · 📝 Corriger des copies · 🧠 Je bloque ·
  🔍 Vérifier mon raisonnement · 📚 Mes épreuves · 📊 Résultats.
- **Résolution de toute l'épreuve** : bilan affiché (questions résolues, questions à vérifier).
  Les questions incertaines ne sont jamais cachées.
- **Correction par lot** (jusqu'à 100 copies et plus) sans bloquer l'interface.
- **Modification humaine** : réponse lue, points, commentaire, barème ; tout est enregistré
  (avant, après, motif, auteur, date).
- **Test hors ligne réel** : installation → mode avion → fermeture → réouverture → import du
  sujet → résolution → import d'une copie → correction → export.
- **Licences** : `docs/choix.md` et `docs/licences.md` (nom, version, usage, licence, usage
  commercial, taille, limites, alternative).
- **Feuille de route** :
  1. architecture existante
  2. résolution
  3. corrigé de référence
  4. copies imprimées
  5. OCR local
  6. manuscrit court
  7. maths avancées
  8. physique
  9. SVT
  10. français
  11. arabe
  12. anglais
  13. philosophie, histoire, géographie, éducation islamique
  14. technique
  15. toutes les séries
  16. BEPC
  17. devoirs
- **Rapport type** après chaque étape : ✓ fonctionne · ⚠ partiel · ✗ ne fonctionne pas ·
  📊 mesures · 🧪 tests · 📱 appareils · 🌐 hors ligne · 📦 packs · ➡ prochaine étape.
- **Règle d'or** : mieux vaut signaler une incertitude que donner une fausse correction.
