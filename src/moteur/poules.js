// Composition des poules et calendrier des tours à l'intérieur d'une poule.

/**
 * Tailles des poules pour n équipes.
 * Règle : poules de `taille` (4 par défaut), complétées par des poules d'une équipe de moins.
 * Exemples en poules de 4 : 64 -> 16x4 ; 57 -> 12x4 + 3x3 ; 6 -> 2x3 ; 5 -> 1x5.
 */
export function taillesPoules(n, taille = 4) {
  if (n <= 0) return [];
  let k = Math.ceil(n / taille);
  while (k > 1 && Math.floor(n / k) < taille - 1) k--;
  const base = Math.floor(n / k);
  const reste = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < reste ? 1 : 0));
}

/** Nom d'une poule de première étape : A, B, ... Z, AA, AB... */
export function lettrePoule(i) {
  let nom = '';
  let x = i;
  do {
    nom = String.fromCharCode(65 + (x % 26)) + nom;
    x = Math.floor(x / 26) - 1;
  } while (x >= 0);
  return nom;
}

// Ordre des matchs repris des Sheets du club pour les poules de 4 :
// tour 1 : 1-2 et 3-4 ; tour 2 : 1-3 et 2-4 ; tour 3 : 1-4 et 2-3.
const CALENDRIERS_FIXES = {
  2: [[[0, 1]]],
  3: [[[0, 1]], [[0, 2]], [[1, 2]]],
  4: [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]],
  ],
};

/**
 * Calendrier d'une poule de n équipes : liste de tours, chaque tour = liste de paires [i, j]
 * (positions dans la poule, à partir de 0). Chaque équipe rencontre toutes les autres une fois.
 */
export function calendrierPoule(n) {
  if (n < 2) return [];
  if (CALENDRIERS_FIXES[n]) return CALENDRIERS_FIXES[n];
  // Méthode du cercle : une équipe fixe, les autres tournent.
  const m = n % 2 === 1 ? n + 1 : n;
  const ids = Array.from({ length: m }, (_, i) => i);
  const tours = [];
  for (let r = 0; r < m - 1; r++) {
    const tour = [];
    for (let i = 0; i < m / 2; i++) {
      const a = ids[i];
      const b = ids[m - 1 - i];
      if (a < n && b < n) tour.push(a < b ? [a, b] : [b, a]);
    }
    tours.push(tour);
    ids.splice(1, 0, ids.pop());
  }
  return tours;
}

/** Nombre de matchs joués en même temps dans une poule de n équipes (donc de planches occupées). */
export function matchsSimultanes(n) {
  return Math.floor(n / 2);
}
