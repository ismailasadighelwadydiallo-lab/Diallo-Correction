import type { Pack } from '../src/index.ts';

/** Petit pack couvrant tous les types de questions (total 20). */
export function packTest(): Pack {
  return {
    format: 'oc-pack/1',
    id: 'test-tous-types',
    titre: 'Devoir de test',
    total: 20,
    langue: 'fr',
    regles: { qcm_multi: 'tout_ou_rien' },
    questions: [
      { id: 'Ex1-Q1', type: 'qcm', enonce: 'QCM simple', points: 1, choix: ['A', 'B', 'C', 'D'], bonnes: ['B'] },
      { id: 'Ex1-Q2', type: 'qcm', enonce: 'QCM multiple', points: 1, choix: ['A', 'B', 'C', 'D'], bonnes: ['A', 'C'] },
      { id: 'Ex1-Q3', type: 'qcm', enonce: 'QCM multiple partiel', points: 1, choix: ['A', 'B', 'C', 'D'], bonnes: ['A', 'B', 'C'], regle_multi: 'partiel' },
      { id: 'Ex2-Q1', type: 'numerique', enonce: 'Vitesse', points: 1, valeur: 12.5, unite: 'm/s', unites: { 'km/h': 1 / 3.6 }, tolerance: { relative: 0.02 } },
      { id: 'Ex2-Q2', type: 'texte_court', enonce: 'Organite', points: 1, reponses: ['mitochondrie', 'la mitochondrie'] },
      {
        id: 'Ex3-Q1', type: 'calcul', enonce: 'Calculer a = 3×4 puis b = 2a + 1 puis c = b²', points: 3,
        etapes: [
          { id: 'a', critere: 'Calcul de a', points: 1, nature: 'calcul', attendu: '3*4', variable: 'a' },
          { id: 'b', critere: 'Calcul de b', points: 1, nature: 'calcul', attendu: '2*a+1', variable: 'b' },
          { id: 'c', critere: 'Calcul de c', points: 1, nature: 'resultat', attendu: 'b^2' },
        ],
      },
      {
        id: 'Ex3-Q2', type: 'demonstration', enonce: "Montrer que f'(x) = (1-x)e^(2-x)", points: 1,
        verification: { moteur: 'math', expression: 'diff(x*exp(2-x), x)', egal_a: '(1-x)*exp(2-x)' },
        etapes: [
          { id: 'methode', critere: 'Dérivée d\'un produit', points: 0.5, nature: 'methode' },
          { id: 'resultat', critere: 'Résultat', points: 0.5, nature: 'resultat', attendu: '(1-x)*exp(2-x)' },
        ],
      },
      {
        id: 'Ex4-Q1', type: 'figure', enonce: 'Tracer la courbe', points: 2,
        etapes: [
          { id: 'repere', critere: 'Repère et échelle', points: 0.5, nature: 'critere' },
          { id: 'points', critere: 'Points remarquables placés', points: 0.5, nature: 'critere' },
          { id: 'allure', critere: 'Allure de la courbe', points: 0.75, nature: 'critere' },
          { id: 'legende', critere: 'Légende', points: 0.25, nature: 'critere' },
        ],
      },
      { id: 'Ex5-Q1', type: 'redaction', enonce: 'Rédaction', points: 9, etapes: [{ critere: 'Fond', points: 6 }, { critere: 'Forme', points: 3 }] },
    ],
  };
}
