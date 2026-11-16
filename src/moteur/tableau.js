// Tableau final d'un niveau : matchs à élimination, matchs de classement et places.
// Ce fichier ne manipule que des « références » (1er de P1, vainqueur du Quart 2...).
// Les équipes réelles sont branchées plus tard par tournoi.js, quand les résultats arrivent.

const estPuissanceDe2 = (n) => n > 0 && (n & (n - 1)) === 0;

/** Ordre classique des têtes de série pour un tableau de `taille` places : [1, 8, 4, 5, 2, 7, 3, 6] pour 8. */
function ordreTetesDeSerie(taille) {
  let ordre = [1];
  while (ordre.length < taille) {
    const n = ordre.length * 2;
    ordre = ordre.flatMap((x) => [x, n + 1 - x]);
  }
  return ordre;
}

/**
 * Premier tour quand le nombre de poules est une puissance de 2 et que 2 équipes sortent par poule.
 * C'est le croisement des Sheets du club : un 1er rencontre toujours un 2e d'une autre poule.
 * 4 poules : Quart 1 = 1er P1 / 2e P2, Quart 2 = 1er P3 / 2e P4, Quart 3 = 1er P2 / 2e P1, Quart 4 = 1er P4 / 2e P3.
 */
function premierTourCroise(poules, ref) {
  if (poules.length === 1) return [[ref(0, 1), ref(0, 2)]];
  const paires = [];
  for (let j = 0; j < poules.length; j += 2) paires.push([ref(j, 1), ref(j + 1, 2)]);
  for (let j = 0; j < poules.length; j += 2) paires.push([ref(j + 1, 1), ref(j, 2)]);
  return paires;
}

/** Premier tour général (autres cas) : têtes de série, exemptions pour les meilleurs, sans duel d'une même poule si possible. */
function premierTourTetesDeSerie(poules, qualifies, ref) {
  const tetes = [];
  for (let rang = 1; rang <= qualifies; rang++) {
    const indices = poules.map((_, i) => i);
    if (rang % 2 === 0) indices.reverse();
    for (const i of indices) { const r = ref(i, rang); if (r) tetes.push(r); }
  }
  let taille = 1;
  while (taille < tetes.length) taille *= 2;
  const ordre = ordreTetesDeSerie(taille);
  const paires = [];
  for (let i = 0; i < ordre.length; i += 2) paires.push([tetes[ordre[i] - 1] || null, tetes[ordre[i + 1] - 1] || null]);
  // Réparation : si deux équipes d'une même poule se rencontrent d'entrée, on échange avec un autre match.
  const memePoule = (p) => p[0] && p[1] && p[0].groupe === p[1].groupe;
  for (const p of paires) {
    if (!memePoule(p)) continue;
    const autre = paires.find((q) => q !== p && q[1] && q[0] && q[1].groupe !== p[0].groupe && q[0].groupe !== p[1].groupe);
    if (autre) [p[1], autre[1]] = [autre[1], p[1]];
  }
  return paires;
}

const NOMS_TOURS = { 1: ['F', 'Finale'], 2: ['D', 'Demie'], 4: ['Q', 'Quart'], 8: ['H', 'Huitième'], 16: ['S', 'Seizième'] };
const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ordinal = (r) => (r === 1 ? '1ers' : `${r}es`);

/**
 * Construit la structure d'un tableau final.
 * @param {string} prefixe    début des identifiants de matchs (ex. "finales:P")
 * @param {object[]} poules   poules du niveau, dans l'ordre : { id, taille }
 * @param {number} qualifies  nombre d'équipes par poule qui entrent dans le tableau (2 par défaut)
 * @param {boolean} matchsClassement  si faux, pas de matchs de classement : les équipes restent ex aequo
 * @returns {{ matchs: object[], paliers: object[][] }}
 *   matchs : { id, tour, libelle, a, b } où a et b sont des références
 *   paliers : groupes de références, dans l'ordre des places (palier 1 = 1re place, etc.)
 */
export function construireTableau({ prefixe, poules, qualifies = 2, matchsClassement = true }) {
  const ref = (i, rang) => (poules[i].taille >= rang ? { type: 'rang', groupe: poules[i].id, rang } : null);
  const paires =
    qualifies === 2 && estPuissanceDe2(poules.length) && poules.every((p) => p.taille >= 2)
      ? premierTourCroise(poules, ref)
      : premierTourTetesDeSerie(poules, qualifies, ref);

  const matchs = [];
  const paliersParTour = []; // paliers des perdants de chaque tour, du premier tour vers la finale
  let paliersTete = [];
  let courant = paires;
  let tour = 1;

  while (courant.length >= 1) {
    const n = courant.length;
    const [code, nom] = NOMS_TOURS[n] || [`T${n}x`, `Tour de ${n * 2}`];
    const sorties = courant.map(([a, b], i) => {
      if (a && b) {
        const id = `${prefixe}:${code}${n === 1 ? '' : i + 1}`;
        matchs.push({ id, tour, principal: true, libelle: n === 1 ? nom : `${nom} ${i + 1}`, a, b });
        return { v: { type: 'vainqueur', match: id }, p: { type: 'perdant', match: id } };
      }
      return { v: a || b, p: null }; // exempt : passe directement au tour suivant
    });
    const perdants = sorties.map((s) => s.p);

    if (n === 1) {
      paliersTete = [[sorties[0].v].filter(Boolean), [sorties[0].p].filter(Boolean)];
    } else if (n === 2) {
      // Petite finale entre les perdants des demies.
      if (perdants[0] && perdants[1] && matchsClassement) {
        const id = `${prefixe}:PF`;
        matchs.push({ id, tour: tour + 1, libelle: 'Petite finale', a: perdants[0], b: perdants[1] });
        paliersParTour.push([[{ type: 'vainqueur', match: id }], [{ type: 'perdant', match: id }]]);
      } else paliersParTour.push([perdants.filter(Boolean)]);
    } else if (n === 4 && matchsClassement) {
      // Matchs de classement 5 à 8 entre perdants des quarts : vainqueurs 5 à 6, perdants 7 à 8.
      const gagnants = [];
      const battus = [];
      for (let i = 0; i < 4; i += 2) {
        const [x, y] = [perdants[i], perdants[i + 1]];
        if (x && y) {
          const id = `${prefixe}:C58${LETTRES[i / 2]}`;
          matchs.push({ id, tour: tour + 1, libelle: `Classement 5 à 8 (${LETTRES[i / 2]})`, a: x, b: y });
          gagnants.push({ type: 'vainqueur', match: id });
          battus.push({ type: 'perdant', match: id });
        } else if (x || y) gagnants.push(x || y);
      }
      paliersParTour.push([gagnants, battus]);
    } else {
      paliersParTour.push([perdants.filter(Boolean)]); // perdants ex aequo, sans match de classement
    }

    if (n === 1) break;
    const suivant = [];
    for (let i = 0; i < n; i += 2) suivant.push([sorties[i].v, sorties[i + 1].v]);
    courant = suivant;
    tour++;
  }

  // Places : finale, puis perdants des tours en remontant vers le premier tour.
  const paliers = [...paliersTete, ...paliersParTour.reverse().flat()];

  // Équipes non qualifiées : les 3es jouent entre eux, les 4es entre eux (poules prises deux par deux).
  const rangMax = Math.max(0, ...poules.map((p) => p.taille));
  for (let rang = qualifies + 1; rang <= rangMax; rang++) {
    const refs = poules.map((_, i) => ref(i, rang)).filter(Boolean);
    const gagnants = [];
    const battus = [];
    for (let i = 0; i < refs.length; i += 2) {
      if (refs[i + 1] && matchsClassement) {
        const id = `${prefixe}:C${rang}${LETTRES[i / 2]}`;
        matchs.push({ id, tour: 1, libelle: `Classement ${ordinal(rang)} (${LETTRES[i / 2]})`, a: refs[i], b: refs[i + 1] });
        gagnants.push({ type: 'vainqueur', match: id });
        battus.push({ type: 'perdant', match: id });
      } else {
        gagnants.push(refs[i]); // pas d'adversaire : classé avec les vainqueurs
        if (refs[i + 1]) gagnants.push(refs[i + 1]);
      }
    }
    paliers.push(gagnants, battus);
  }

  // Dans un tour : d'abord les matchs du tableau, puis les matchs de classement (ordre des planches du Sheet).
  matchs.sort((x, y) => x.tour - y.tour || (y.principal ? 1 : 0) - (x.principal ? 1 : 0));
  return { matchs, paliers: paliers.filter((p) => p.length > 0) };
}

/** Libellé d'une place ou d'une fourchette de places ex aequo : « 5 à 6 ». */
export function libellePlace(debut, taille) {
  return taille <= 1 ? String(debut) : `${debut} à ${debut + taille - 1}`;
}
