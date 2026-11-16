// Liste des formats disponibles. Pour en ajouter un : créer un fichier ici et l'inscrire ci-dessous
// (voir documentation/ajouter-un-format.md).
import palets from './palets.js';
import cornhole from './cornhole.js';

export const FORMATS = {
  [palets.id]: palets,
  [cornhole.id]: cornhole,
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
];
