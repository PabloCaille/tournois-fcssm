// Passage d'une étape de poules à la suivante :
// « le rang r de la poule X de l'étape n va dans la poule Y de l'étape n+1 ».
// Règle du club : deux équipes sorties de la même poule ne se retrouvent jamais ensemble.

import { taillesPoules } from './poules.js';

/**
 * Liste les entrants de chaque niveau.
 * @param {object[]} sources  poules de l'étape précédente, dans l'ordre : { id, taille }
 * @param {object[]} niveaux  niveaux du format : { id, rangs: [1, 2] }
 * @returns {object[][]} pour chaque niveau, les entrants { groupe, rang, ordreRang } triés par rang puis par poule
 */
export function entrantsParNiveau(sources, niveaux) {
  const rangMax = Math.max(0, ...sources.map((s) => s.taille));
  const rangsPris = new Set(niveaux.flatMap((n) => n.rangs));
  return niveaux.map((niveau, i) => {
    const rangs = niveau.rangs.slice();
    // Le dernier niveau récupère les rangs non prévus (poules de 5 par exemple).
    if (i === niveaux.length - 1) {
      for (let r = 1; r <= rangMax; r++) if (!rangsPris.has(r)) rangs.push(r);
    }
    const entrants = [];
    rangs.forEach((rang, ordreRang) => {
      for (const s of sources) if (s.taille >= rang) entrants.push({ groupe: s.id, rang, ordreRang });
    });
    return entrants;
  });
}

/** Vrai si aucune poule ne contient deux équipes de la même poule d'origine et si les tailles sont équilibrées. */
export function repartitionValide(poules) {
  if (poules.length <= 1) return true;
  const tailles = poules.map((p) => p.length);
  if (Math.max(...tailles) - Math.min(...tailles) > 1) return false;
  return poules.every((p) => new Set(p.map((e) => e.groupe)).size === p.length);
}

/** Répartition de secours : chaque entrant va dans la poule la moins remplie qui ne contient pas sa poule d'origine. */
function repartirGlouton(entrants, tailles) {
  const poules = tailles.map(() => []);
  entrants.forEach((e, j) => {
    const candidats = poules
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => p.length < tailles[i] && !p.some((x) => x.groupe === e.groupe));
    const libres = candidats.length ? candidats : poules.map((p, i) => ({ p, i })).filter(({ p, i }) => p.length < tailles[i]);
    // À taille égale, on tourne pour ne pas toujours remplir la première poule.
    libres.sort((x, y) => x.p.length - y.p.length || ((x.i - j + poules.length * 4) % poules.length) - ((y.i - j + poules.length * 4) % poules.length));
    libres[0].p.push(e);
  });
  // Réparation : s'il reste deux équipes d'une même origine dans une poule, on échange l'une d'elles
  // avec une équipe d'une autre poule, tant que l'échange ne crée pas un nouveau doublon.
  const doublon = (p) => p.find((x, i) => p.some((y, j) => j < i && y.groupe === x.groupe));
  for (let essai = 0; essai < 50; essai++) {
    const p = poules.find((x) => doublon(x));
    if (!p) break;
    const y = doublon(p);
    let fait = false;
    for (const q of poules) {
      if (q === p || fait) continue;
      for (const z of q) {
        const okQ = !q.some((x) => x !== z && x.groupe === y.groupe);
        const okP = !p.some((x) => x !== y && x.groupe === z.groupe);
        if (okQ && okP) { p[p.indexOf(y)] = z; q[q.indexOf(z)] = y; fait = true; break; }
      }
    }
    if (!fait) break;
  }
  return poules;
}

/**
 * Répartit les entrants d'un niveau dans ses poules.
 * - « cyclique » (palets) : A, B, C, D puis E, F, G, H... chacun dans la poule suivante.
 *   Avec 16 poules et 4 poules de niveau : P1 = A, E, I, M (comme le Sheet).
 * - « serpentin » (cornhole) : aller puis retour, et les rangs pairs partent de la dernière poule.
 *   Avec 8 poules : P1 = 1er A, 1er H, 2e D, 2e E (comme le Sheet).
 * Si le résultat réunit deux équipes d'une même poule d'origine, on bascule sur la répartition de secours.
 */
export function repartir(entrants, mode = 'cyclique', taillePoule = 4) {
  const tailles = taillesPoules(entrants.length, taillePoule);
  const k = tailles.length;
  if (k === 0) return [];
  const poules = tailles.map(() => []);
  if (mode === 'serpentin') {
    const parRang = new Map();
    for (const e of entrants) {
      if (!parRang.has(e.ordreRang)) parRang.set(e.ordreRang, []);
      parRang.get(e.ordreRang).push(e);
    }
    for (const [ordreRang, liste] of parRang) {
      liste.forEach((e, j) => {
        const aller = Math.floor(j / k) % 2 === 0;
        let i = aller ? j % k : k - 1 - (j % k);
        if (ordreRang % 2 === 1) i = k - 1 - i;
        poules[i].push(e);
      });
    }
  } else {
    entrants.forEach((e, j) => poules[j % k].push(e));
  }
  return repartitionValide(poules) ? poules : repartirGlouton(entrants, tailles);
}

/** Liste les paires d'équipes d'une même poule qui étaient déjà ensemble à l'étape d'origine (contrôle de la règle). */
export function conflitsMemeOrigine(equipes, origine) {
  const conflits = [];
  for (let i = 0; i < equipes.length; i++) {
    for (let j = i + 1; j < equipes.length; j++) {
      const a = equipes[i];
      const b = equipes[j];
      if (a != null && b != null && origine.get(a) != null && origine.get(a) === origine.get(b)) conflits.push([a, b]);
    }
  }
  return conflits;
}
