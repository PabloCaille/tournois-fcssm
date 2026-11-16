// Quinte féminine : deux formules au choix, à comparer dans la rubrique Planning.
//   A « toutes contre toutes » : une seule poule, le classement de la poule est le classement final.
//   B « deux poules puis phase finale » : demies croisées, finale, petite finale, matchs de classement.
import { PARAMETRES_COMMUNS } from './commun.js';

const parametres = {
  ...PARAMETRES_COMMUNS,
  scoreCible: 0,
  criteres: ['points', 'difference', 'marques', 'confrontation'],
  nbLieux: 4,
  dureeMatch: 12,
  forfait: { pour: 3, contre: 0 },
  departageFinale: 'Tirs au but',
};

export default {
  id: 'quinte-feminin',
  nom: 'Quinte féminine',
  nomLieu: 'Terrain',
  parametres,
  etapes: [{ id: 'poule', nom: 'Championnat', type: 'poules' }],
  varianteDefaut: 'A',
  variantes: {
    A: {
      nom: 'Toutes contre toutes',
      parametres: { nbPoules: 1 },
      etapes: [{ id: 'poule', nom: 'Championnat', type: 'poules' }],
    },
    B: {
      nom: 'Deux poules puis phase finale',
      parametres: { nbPoules: 2 },
      etapes: [
        { id: 'poules', nom: 'Poules', type: 'poules' },
        { id: 'finales', nom: 'Phase finale', type: 'tableaux', source: 'poules' },
      ],
    },
  },
};
