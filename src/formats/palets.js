// Format du tournoi de palets du FCSSM (règlement du 14/11/2026).
// 3 temps : poules de brassage, poules de niveau (un niveau par rang), tableaux finaux.
import { PARAMETRES_COMMUNS } from './commun.js';

export default {
  id: 'palets',
  nom: 'Palets',
  nomLieu: 'Planche',
  parametres: {
    ...PARAMETRES_COMMUNS,
    scoreCible: 11,
    plafonnerScore: true, // un score supérieur à 11 compte pour 11
    nbLieux: 32,
    forfait: { pour: 11, contre: 0 },
  },
  etapes: [
    { id: 'phase1', nom: 'Phase 1', type: 'poules' },
    {
      id: 'phase2',
      nom: 'Phase 2',
      type: 'poules',
      source: 'phase1',
      // Chaque rang de phase 1 part dans son niveau : 1er -> Principale, 2e -> Principale Challenge, etc.
      niveaux: [
        { id: 'P', nom: 'Principale', prefixe: 'P', rangs: [1] },
        { id: 'PC', nom: 'Principale Challenge', prefixe: 'PC', rangs: [2] },
        { id: 'C', nom: 'Consolante', prefixe: 'C', rangs: [3] },
        { id: 'CC', nom: 'Consolante Challenge', prefixe: 'CC', rangs: [4] },
      ],
      repartition: 'cyclique', // P1 = 1ers de A, E, I, M
    },
    { id: 'finales', nom: 'Phases finales', type: 'tableaux', source: 'phase2' },
  ],
};
