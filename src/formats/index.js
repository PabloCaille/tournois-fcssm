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
