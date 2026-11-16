// Liste des formats disponibles. Pour en ajouter un : créer un fichier ici et l'inscrire ci-dessous
// (voir documentation/ajouter-un-format.md).
import palets from './palets.js';
import cornhole from './cornhole.js';
import quinteMasculin from './quinte-masculin.js';
import quinteFeminin from './quinte-feminin.js';

export const FORMATS = {
  [palets.id]: palets,
  [cornhole.id]: cornhole,
  [quinteMasculin.id]: quinteMasculin,
  [quinteFeminin.id]: quinteFeminin,
};

export function formatDe(id) {
  const f = FORMATS[id];
  if (!f) throw new Error(`Format inconnu : ${id}`);
  return f;
}

// Modèles d'événement proposés à la création : un événement contient un ou plusieurs tournois.
export const MODELES = [
  { id: 'palets', nom: 'Palets', nomDefaut: 'Tournoi de palets FCSSM', tournois: [{ cle: 'principal', nom: 'Palets', format: 'palets' }] },
  { id: 'cornhole', nom: 'Cornhole', nomDefaut: 'Tournoi de cornhole FCSSM', tournois: [{ cle: 'principal', nom: 'Cornhole', format: 'cornhole' }] },
  {
    id: 'quinte',
    nom: 'Quinte (masculin et féminin)',
    nomDefaut: 'Tournoi de quinte FCSSM',
    tournois: [
      { cle: 'M', nom: 'Masculin', format: 'quinte-masculin' },
      { cle: 'F', nom: 'Féminin', format: 'quinte-feminin', variante: 'A' },
    ],
    // Réglages horaires par défaut de la journée (modifiables dans la rubrique Planning).
    planning: { nbTerrains: 4, debut: '09:00', fin: '18:00', duree: 12, battement: 3, pause: 10, rythme: { M: 3, F: 1 } },
  },
];
