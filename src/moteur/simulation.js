// Simulation d'un tournoi complet avec des scores au hasard.
// Sert aux tests automatiques et au bouton « Démonstration » de la table de marque.

import { creerAlea } from './aleatoire.js';
import { calculer } from './tournoi.js';
import { creerTournoi, definirEquipes, tirerAuSort, saisirScore, trancherEgalite } from './actions.js';

/** Score au hasard : un vainqueur au score cible la plupart du temps, parfois un nul (limite de temps). */
function scoreAuHasard(alea, cible, enTableau) {
  const max = cible > 0 ? cible : 5;
  if (!enTableau && alea() < 0.08) { const x = Math.floor(alea() * max); return { a: x, b: x }; }
  const perdant = Math.floor(alea() * max);
  const gagnant = cible > 0 ? cible : perdant + 1 + Math.floor(alea() * 3);
  if (enTableau && alea() < 0.05) { const x = Math.floor(alea() * max); return { a: x, b: x, vainqueur: alea() < 0.5 ? 'a' : 'b' }; }
  return alea() < 0.5 ? { a: gagnant, b: perdant } : { a: perdant, b: gagnant };
}

/** Joue la manche en cours (tous ses matchs prêts). Retourne le tournoi mis à jour, ou le même si rien à jouer. */
export function jouerMancheCourante(tournoi, alea) {
  const vue = calculer(tournoi);
  let t = tournoi;
  // Les égalités parfaites sont tranchées dans l'ordre par défaut, comme le ferait la table de marque.
  for (const al of vue.alertes) if (al.type === 'egalite') t = trancherEgalite(t, al.cle, al.equipes).tournoi;
  const manche = calculer(t).mancheCourante;
  if (!manche) return t;
  for (const m of manche.matchs) {
    if (m.joue || !m.pret) continue;
    t = saisirScore(t, m.id, scoreAuHasard(alea, vue.parametres.scoreCible, m.type === 'tableau')).tournoi;
  }
  return t;
}

/** Crée un tournoi de n équipes et le joue jusqu'au bout. */
export function simulerTournoi({ format, n, graine = 1, variante = null, parametres = {} }) {
  const alea = creerAlea(graine);
  let t = creerTournoi({ format, variante, parametres });
  t = definirEquipes(t, Array.from({ length: n }, (_, i) => ({ nom: `Équipe ${i + 1}`, joueurs: [] }))).tournoi;
  t = tirerAuSort(t, graine).tournoi;
  for (let garde = 0; garde < 200; garde++) {
    const suivant = jouerMancheCourante(t, alea);
    if (suivant === t) break;
    t = suivant;
  }
  return t;
}
