// Hasard reproductible : une même graine donne toujours le même tirage.
// Le tirage au sort est donc figé tant que la graine ne change pas.

/** Générateur pseudo-aléatoire (mulberry32). Retourne une fonction qui rend un nombre dans [0, 1[. */
export function creerAlea(graine) {
  let a = graine >>> 0;
  return function alea() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange une copie de la liste (Fisher-Yates). */
export function melanger(liste, alea) {
  const copie = liste.slice();
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/** Transforme un texte en entier 32 bits (sert au tirage au sort figé des égalités parfaites). */
export function hacher(texte) {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Graine nouvelle, à appeler depuis l'interface uniquement (le moteur n'utilise jamais l'horloge). */
export function nouvelleGraine() {
  return Math.floor(Math.random() * 4294967296);
}
