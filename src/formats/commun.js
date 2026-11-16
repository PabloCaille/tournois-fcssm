// Paramètres par défaut communs à tous les formats.
// Chaque format peut en remplacer une partie, et chaque tournoi peut encore les modifier depuis l'interface.
// Ce sont des DONNÉES : aucune règle sportive ne doit être écrite ailleurs que dans les formats et le moteur.

export const PARAMETRES_COMMUNS = {
  // Barème en poule.
  points: { victoire: 3, nul: 1, defaite: 0 },
  // Score à atteindre pour gagner (0 = pas de score cible, match à durée fixe).
  scoreCible: 0,
  // Si vrai, un score au-dessus du score cible compte comme le score cible dans les classements.
  plafonnerScore: false,
  // Critères de départage en poule, dans l'ordre. Voir src/moteur/classement.js pour la liste.
  criteres: ['points', 'difference', 'marques'],
  // Taille visée des poules (complétées par des poules d'une équipe de moins).
  taillePoule: 4,
  // Nombre d'équipes par poule qui entrent dans le tableau final.
  qualifiesParPoule: 2,
  // Matchs de classement (5 à 8, 3es entre eux, 4es entre eux, petite finale).
  matchsClassement: true,
  // Nombre de planches ou de terrains disponibles.
  nbLieux: 16,
  // Score enregistré en cas de forfait : « pour » à l'équipe présente, « contre » à l'équipe absente.
  forfait: { pour: 11, contre: 0 },
  // Correction d'un score déjà saisi : 'tracee' (autorisée, avec journal) ou 'interdite'.
  correctionScore: 'tracee',
  // Afficher les noms des joueurs sur les pages publiques (faux par défaut : des mineurs peuvent jouer).
  afficherJoueurs: false,
  // Durée d'un match en minutes (information ; sert au planning pour la quinte).
  dureeMatch: 0,
  // Comment on départage un match nul en phase finale (texte affiché à la table).
  departageFinale: 'Une mène supplémentaire, la première équipe qui marque gagne',
};
