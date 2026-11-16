// Classement d'une poule : barème, critères de départage dans l'ordre, égalités parfaites.
// Tout vient des paramètres du tournoi : rien n'est figé ici.

import { hacher } from './aleatoire.js';

/** Score retenu pour le classement : au-delà du score cible, on compte le score cible (règlement palets 2.4). */
export function scoreRetenu(valeur, parametres) {
  const cible = parametres.scoreCible;
  if (parametres.plafonnerScore && cible > 0 && valeur > cible) return cible;
  return valeur;
}

/** Statistiques brutes de chaque équipe à partir des matchs joués. */
function calculerLignes(equipes, matchs, parametres) {
  const lignes = new Map(
    equipes.map((id) => [id, { equipe: id, j: 0, v: 0, n: 0, d: 0, pts: 0, pour: 0, contre: 0, diff: 0 }])
  );
  for (const m of matchs) {
    if (!m.score || !lignes.has(m.a) || !lignes.has(m.b)) continue;
    const sa = scoreRetenu(m.score.a, parametres);
    const sb = scoreRetenu(m.score.b, parametres);
    const la = lignes.get(m.a);
    const lb = lignes.get(m.b);
    la.j++; lb.j++;
    la.pour += sa; la.contre += sb;
    lb.pour += sb; lb.contre += sa;
    if (sa > sb) { la.v++; lb.d++; la.pts += parametres.points.victoire; lb.pts += parametres.points.defaite; }
    else if (sb > sa) { lb.v++; la.d++; lb.pts += parametres.points.victoire; la.pts += parametres.points.defaite; }
    else { la.n++; lb.n++; la.pts += parametres.points.nul; lb.pts += parametres.points.nul; }
  }
  for (const l of lignes.values()) l.diff = l.pour - l.contre;
  return lignes;
}

// Critères simples : une valeur par équipe, la plus grande passe devant.
// Pour ajouter un critère, ajouter une ligne ici (voir documentation/changer-un-critere.md).
export const CRITERES = {
  points: { nom: 'Points', valeur: (l) => l.pts },
  difference: { nom: 'Différence', valeur: (l) => l.diff },
  marques: { nom: 'Points marqués', valeur: (l) => l.pour },
  encaisses: { nom: 'Points encaissés (le moins)', valeur: (l) => -l.contre },
  victoires: { nom: 'Nombre de victoires', valeur: (l) => l.v },
  // « confrontation » est traité à part : il dépend du groupe d'équipes à égalité.
  confrontation: { nom: 'Confrontation directe' },
};

/** Valeur du critère « confrontation directe » : mini-classement entre les seules équipes à égalité. */
function valeursConfrontation(groupe, matchs, parametres) {
  const ids = groupe.map((l) => l.equipe);
  const entreEux = matchs.filter((m) => ids.includes(m.a) && ids.includes(m.b));
  const mini = calculerLignes(ids, entreEux, parametres);
  return new Map(ids.map((id) => [id, mini.get(id).pts * 100000 + mini.get(id).diff]));
}

/** Découpe un groupe d'équipes à égalité selon un critère. Retourne des sous-groupes, du meilleur au moins bon. */
function departager(groupe, critere, matchs, parametres) {
  let valeurs;
  if (critere === 'confrontation') valeurs = valeursConfrontation(groupe, matchs, parametres);
  else {
    const def = CRITERES[critere];
    if (!def) return [groupe]; // critère inconnu : ignoré
    valeurs = new Map(groupe.map((l) => [l.equipe, def.valeur(l)]));
  }
  const tries = groupe.slice().sort((x, y) => valeurs.get(y.equipe) - valeurs.get(x.equipe));
  const sousGroupes = [];
  for (const l of tries) {
    const dernier = sousGroupes[sousGroupes.length - 1];
    if (dernier && valeurs.get(dernier[0].equipe) === valeurs.get(l.equipe)) dernier.push(l);
    else sousGroupes.push([l]);
  }
  return sousGroupes;
}

/**
 * Classe une poule.
 * @param {object} p
 * @param {number[]} p.equipes    identifiants des équipes de la poule
 * @param {object[]} p.matchs     matchs de la poule : { a, b, score: {a, b} | null }
 * @param {object} p.parametres   paramètres du tournoi (barème, critères, score cible)
 * @param {string} p.cle          identifiant de la poule, sert au tirage au sort figé
 * @param {number} p.graine       graine du tournoi
 * @param {number[]} [p.decision] ordre choisi par la table de marque pour les équipes à égalité parfaite
 * @returns {{ lignes: object[], egalites: object[], terminee: boolean }}
 */
export function classerPoule({ equipes, matchs, parametres, cle = '', graine = 0, decision = null }) {
  const lignes = calculerLignes(equipes, matchs, parametres);
  const terminee = matchs.length > 0 ? matchs.every((m) => m.score) : equipes.length <= 1;

  let groupes = [Array.from(lignes.values())];
  for (const critere of parametres.criteres) {
    groupes = groupes.flatMap((g) => (g.length > 1 ? departager(g, critere, matchs, parametres) : [g]));
  }

  const egalites = [];
  const ordre = [];
  for (const g of groupes) {
    if (g.length === 1) { ordre.push(g[0]); continue; }
    // Égalité parfaite : les critères automatiques ne suffisent pas.
    const ids = g.map((l) => l.equipe);
    const resolue = Array.isArray(decision) && ids.every((id) => decision.includes(id));
    const tirage = (id) => hacher(`${graine}:${cle}:${id}`);
    const tries = g.slice().sort((x, y) =>
      resolue
        ? decision.indexOf(x.equipe) - decision.indexOf(y.equipe)
        : tirage(x.equipe) - tirage(y.equipe) || x.equipe - y.equipe
    );
    // Règle par défaut : tirage au sort figé, pour que rien ne bloque en attendant la table de marque.
    if (terminee) egalites.push({ equipes: tries.map((l) => l.equipe), resolue });
    for (const l of tries) { l.egalite = terminee ? (resolue ? 'tranchee' : 'en-cours') : null; ordre.push(l); }
  }
  ordre.forEach((l, i) => { l.rang = i + 1; });
  return { lignes: ordre, egalites, terminee };
}
