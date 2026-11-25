// Normalisation des réponses courtes : majuscules, accents, espaces et ponctuation ignorés.
// Arabe : voyelles brèves (harakat), tatweel, formes de alif/ya/ta marbuta unifiées.

export function normaliserTexte(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // accents latins
    .replace(/[ً-ٰٟـ]/g, '') // harakat, alif suscrit, tatweel
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ → ا
    .replace(/ى/g, 'ي') // ى → ي
    .replace(/ة/g, 'ه') // ة → ه
    .normalize('NFC')
    .toLowerCase()
    .replace(/[œ]/g, 'oe')
    .replace(/[æ]/g, 'ae')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

export function texteCorrespond(reponse: string, acceptees: string[]): string | null {
  const n = normaliserTexte(reponse);
  if (!n) return null;
  return acceptees.find((a) => normaliserTexte(a) === n) ?? null;
}
