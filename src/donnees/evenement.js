// Un « événement » regroupe ce qui se joue le même jour : un tournoi (palets, cornhole)
// ou plusieurs qui partagent les terrains (quinte masculine et féminine).
// C'est le document enregistré et diffusé. Fonctions pures, sans stockage.
//
// {
//   v: 1, id, nom,
//   tournois: [tournoi, ...]      voir src/moteur/actions.js
//   planning: { ... } ou null     réglages horaires de la quinte
//   affichage: { duree: 15 }      secondes par vue sur le vidéoprojecteur
//   journal: [{ date, qui, tournoi, type, ... }]
//   rev: 12, maj: '2026-11-16T19:00:00.000Z'
// }

export function creerEvenement({ id, nom, tournois, planning = null }) {
  return { v: 1, id, nom, tournois, planning, affichage: { duree: 15 }, journal: [], rev: 0, maj: null };
}

/** Fabrique un identifiant d'adresse web à partir d'un nom : « Palets FCSSM 2026 » -> « palets-fcssm-2026 ». */
export function identifiantDepuisNom(nom) {
  return String(nom || 'tournoi')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'tournoi';
}

/**
 * Applique une action du moteur à l'un des tournois de l'événement et l'inscrit au journal.
 * @param {object} evenement
 * @param {string} cle        clé du tournoi concerné
 * @param {function} action   (tournoi) => { tournoi, trace }
 * @param {object} contexte   { date, qui } fournis par l'interface
 */
export function appliquer(evenement, cle, action, { date, qui = '' }) {
  const index = evenement.tournois.findIndex((t) => t.cle === cle);
  if (index < 0) throw new Error(`Tournoi introuvable : ${cle}`);
  const { tournoi, trace } = action(evenement.tournois[index]);
  const tournois = evenement.tournois.slice();
  tournois[index] = tournoi;
  const journal = trace ? [...evenement.journal, { date, qui, tournoi: cle, ...trace }] : evenement.journal;
  return { ...evenement, tournois, journal, rev: evenement.rev + 1, maj: date };
}

/** Modifie l'événement lui-même (nom, planning, affichage) avec une ligne de journal. */
export function modifierEvenement(evenement, champs, trace, { date, qui = '' }) {
  const journal = trace ? [...evenement.journal, { date, qui, ...trace }] : evenement.journal;
  return { ...evenement, ...champs, journal, rev: evenement.rev + 1, maj: date };
}
