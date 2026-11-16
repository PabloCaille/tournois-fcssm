// Quinte masculine (football à 5) : poules, puis nouvelles poules par niveau, puis tableaux finaux.
// Même mécanique que le cornhole, avec en plus un terrain et une heure par match (voir src/moteur/planning.js).
// Hypothèses notées dans documentation/ecarts.md : à ajuster dans l'interface, pas dans le code.
import { PARAMETRES_COMMUNS } from './commun.js';

export default {
  id: 'quinte-masculin',
  nom: 'Quinte masculine',
  nomLieu: 'Terrain',
  parametres: {
    ...PARAMETRES_COMMUNS,
    scoreCible: 0, // match à durée fixe : on compte les buts
    criteres: ['points', 'difference', 'marques', 'confrontation'],
    nbLieux: 4,
    dureeMatch: 12,
    forfait: { pour: 3, contre: 0 },
    departageFinale: 'Tirs au but',
  },
  etapes: [
    { id: 'poules', nom: 'Poules', type: 'poules' },
    {
      id: 'niveaux',
      nom: 'Poules de niveau',
      type: 'poules',
      source: 'poules',
      niveaux: [
        { id: 'P', nom: 'Principale', prefixe: 'P', rangs: [1, 2] },
        { id: 'C', nom: 'Consolante', prefixe: 'C', rangs: [3, 4] },
      ],
      repartition: 'serpentin',
    },
    { id: 'finales', nom: 'Phases finales', type: 'tableaux', source: 'niveaux' },
  ],
};
