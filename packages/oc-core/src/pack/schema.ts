// Schéma JSON (draft-07) d'un pack "oc-pack/1". Exporté aussi dans packs/oc-pack.schema.json.

const etape = {
  type: 'object',
  required: ['critere', 'points'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1 },
    critere: { type: 'string', minLength: 1 },
    points: { type: 'number', minimum: 0 },
    nature: { enum: ['methode', 'calcul', 'resultat', 'justification', 'critere'] },
    attendu: { type: 'string' },
    variable: { type: 'string', pattern: '^[A-Za-z_][A-Za-z0-9_]*$' },
    tolerance: { type: 'number', exclusiveMinimum: 0 },
  },
} as const;

const verification = {
  type: 'object',
  required: ['moteur', 'expression'],
  additionalProperties: false,
  properties: {
    moteur: { const: 'math' },
    type: { enum: ['egal', 'racines', 'primitive'] },
    expression: { type: 'string', minLength: 1 },
    egal_a: { type: 'string' },
    valeurs: { type: 'array', items: { type: ['number', 'string'] } },
    variable: { type: 'string' },
  },
} as const;

const base = {
  id: { type: 'string', minLength: 1 },
  exercice: { type: 'string' },
  enonce: { type: 'string' },
  points: { type: 'number', exclusiveMinimum: 0 },
  attendu: { type: 'string' },
  verification,
  etapes: { type: 'array', items: etape },
  a_relire: { type: 'string' },
} as const;

export const packSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://offline-correction.local/oc-pack-1.schema.json',
  title: "Pack d'épreuve Offline Correction",
  type: 'object',
  required: ['format', 'id', 'titre', 'total', 'langue', 'questions'],
  additionalProperties: false,
  properties: {
    format: { const: 'oc-pack/1' },
    id: { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]*$' },
    titre: { type: 'string', minLength: 1 },
    serie: { type: 'string' },
    duree: { type: 'string' },
    session: { type: 'string' },
    total: { type: 'number', exclusiveMinimum: 0 },
    langue: { enum: ['fr', 'ar'] },
    regles: {
      type: 'object',
      additionalProperties: false,
      properties: {
        qcm_multi: { enum: ['tout_ou_rien', 'partiel'] },
        qcm_negatif: { type: 'boolean' },
        seuil_confiance: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    meta: {
      type: 'object',
      properties: {
        source: { type: 'string' },
        auteur: { type: 'string' },
        cree_le: { type: 'string' },
        a_relire: { type: 'array', items: { type: 'string' } },
      },
    },
    questions: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'enonce', 'points', 'type'],
        properties: { type: { enum: ['qcm', 'numerique', 'texte_court', 'calcul', 'demonstration', 'figure', 'redaction'] } },
        allOf: [
          {
            if: { properties: { type: { const: 'qcm' } } },
            then: {
              required: ['choix', 'bonnes'],
              additionalProperties: false,
              properties: {
                ...base,
                type: { const: 'qcm' },
                choix: { type: 'array', minItems: 2, maxItems: 6, uniqueItems: true, items: { type: 'string', minLength: 1 } },
                bonnes: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string' } },
                regle_multi: { enum: ['tout_ou_rien', 'partiel'] },
                penalite: { type: 'number', minimum: 0 },
              },
            },
          },
          {
            if: { properties: { type: { const: 'numerique' } } },
            then: {
              required: ['valeur'],
              additionalProperties: false,
              properties: {
                ...base,
                type: { const: 'numerique' },
                valeur: { type: 'number' },
                tolerance: {
                  type: 'object',
                  additionalProperties: false,
                  properties: { absolue: { type: 'number', minimum: 0 }, relative: { type: 'number', minimum: 0 } },
                },
                unite: { type: 'string' },
                unites: { type: 'object', additionalProperties: { type: 'number', exclusiveMinimum: 0 } },
                penalite_unite: { type: 'number', minimum: 0 },
              },
            },
          },
          {
            if: { properties: { type: { const: 'texte_court' } } },
            then: {
              required: ['reponses'],
              additionalProperties: false,
              properties: {
                ...base,
                type: { const: 'texte_court' },
                reponses: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
              },
            },
          },
          {
            if: { properties: { type: { enum: ['calcul', 'demonstration', 'figure', 'redaction'] } } },
            then: {
              required: ['etapes'],
              additionalProperties: false,
              properties: {
                ...base,
                type: { enum: ['calcul', 'demonstration', 'figure', 'redaction'] },
                etapes: { type: 'array', minItems: 1, items: etape },
                montrer_que: { type: 'boolean' },
              },
            },
          },
        ],
      },
    },
  },
} as const;
