// Les 10 questions de test (français et arabe).
// `verif` est un contrôle automatique grossier (mots-clés) : il signale une réponse
// probablement juste, il ne remplace pas la lecture du rapport.

export interface QuestionTest {
  id: string;
  langue: 'fr' | 'ar';
  texte: string;
  verif: (r: string) => boolean;
  attendu: string;
}

const n = (s: string) => s.normalize('NFD').replace(/[̀-ًͯ-ٟ]/g, '').toLowerCase();
// chiffres arabes orientaux → occidentaux
const chiffres = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export const QUESTIONS: QuestionTest[] = [
  { id: 'fr-equation', langue: 'fr', texte: 'Résous x² − 5x + 6 = 0.', attendu: 'x = 2 ou x = 3', verif: (r) => /\b2\b/.test(r) && /\b3\b/.test(r) },
  { id: 'fr-derivee', langue: 'fr', texte: 'Calcule la dérivée de f(x) = x·e^(2−x).', attendu: "f'(x) = (1 − x)e^(2−x)", verif: (r) => /1\s*[-−–]\s*x/.test(r) },
  { id: 'fr-capitale', langue: 'fr', texte: 'Quelle est la capitale de la Mauritanie ?', attendu: 'Nouakchott', verif: (r) => n(r).includes('nouakchott') },
  { id: 'fr-photosynthese', langue: 'fr', texte: "Explique en deux phrases ce qu'est la photosynthèse.", attendu: 'lumière, CO₂, eau → glucose, O₂ (chlorophylle)', verif: (r) => /lumi|chlorophyl/.test(n(r)) },
  { id: 'fr-probleme', langue: 'fr', texte: 'Un train roule à 90 km/h pendant 2 h 30 min. Quelle distance parcourt-il ?', attendu: '225 km', verif: (r) => /225/.test(r) },
  { id: 'fr-orthographe', langue: 'fr', texte: 'Corrige les fautes : « Les élève a fini leur devoir hier. »', attendu: 'Les élèves ont fini leur devoir hier.', verif: (r) => /eleves ont/.test(n(r)) },
  { id: 'ar-equation', langue: 'ar', texte: 'حل المعادلة: 2x + 3 = 11', attendu: 'x = 4', verif: (r) => /\b4\b/.test(chiffres(r)) },
  { id: 'ar-capitale', langue: 'ar', texte: 'ما هي عاصمة موريتانيا؟', attendu: 'نواكشوط', verif: (r) => /نواكشوط|انواكشوط/.test(n(r)) },
  { id: 'ar-photosynthese', langue: 'ar', texte: 'اشرح باختصار ما هو التمثيل الضوئي.', attendu: 'الضوء، الكلوروفيل، ثاني أكسيد الكربون → سكر وأكسجين', verif: (r) => /ضوء|ضوئ|كلوروفيل|يخضور/.test(n(r)) },
  { id: 'ar-traduction', langue: 'ar', texte: 'ترجم إلى الفرنسية: «الطالب يقرأ الكتاب»', attendu: "L'élève (l'étudiant) lit le livre.", verif: (r) => /lit/.test(n(r)) && /livre/.test(n(r)) },
];

export const SYSTEME =
  "Tu es un assistant pour un enseignant en Mauritanie. Réponds brièvement (5 lignes au plus), dans la langue de la question. أجب باختصار وبلغة السؤال.";
