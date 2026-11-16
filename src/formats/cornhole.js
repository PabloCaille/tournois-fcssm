// Format du tournoi de cornhole du FCSSM (repris du Sheet « Tournoi Cornhole FCSSM 32 equipes »).
// Même logique que les palets, sur 2 niveaux : 1ers et 2es en Principale, 3es et 4es en Consolante.
import { PARAMETRES_COMMUNS } from './commun.js';

export default {
  id: 'cornhole',
  nom: 'Cornhole',
  nomLieu: 'Planche',
  parametres: {
    ...PARAMETRES_COMMUNS,
    scoreCible: 21,
    plafonnerScore: true,
    nbLieux: 16,
    forfait: { pour: 21, contre: 0 },
    departageFinale: 'Une manche supplémentaire',
  },
  etapes: [
    { id: 'matin', nom: 'Poules du matin', type: 'poules' },
    {
      id: 'apresmidi',
      nom: "Poules de l'après-midi",
      type: 'poules',
      source: 'matin',
      niveaux: [
        { id: 'P', nom: 'Principale', prefixe: 'P', rangs: [1, 2] },
        { id: 'C', nom: 'Consolante', prefixe: 'C', rangs: [3, 4] },
      ],
      repartition: 'serpentin', // P1 = 1er A, 1er H, 2e D, 2e E
    },
    { id: 'finales', nom: 'Phases finales', type: 'tableaux', source: 'apresmidi' },
  ],
};
