// Planning horaire de la quinte : attribue un terrain et une heure à chaque match,
// tournois masculin et féminin mélangés sur les mêmes terrains.
// Fonction pure. Le planning ne dépend que de la structure (nombre d'équipes, format),
// pas des résultats : il est donc connu dès le tirage, pour toute la journée.
//
// Garanties :
// - deux matchs ne partagent jamais le même terrain à la même heure ;
// - une équipe ne joue jamais deux matchs en même temps et dispose de la pause minimale entre deux matchs,
//   y compris quand son adversaire n'est pas encore connu (on attend la fin des matchs dont elle peut venir).

import { calculer } from './tournoi.js';
import { creerTournoi, definirEquipes, tirerAuSort } from './actions.js';

const enMinutes = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
const enHeure = (minutes) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Pour chaque match, la liste des matchs qui doivent être terminés avant lui :
 * les matchs précédents des mêmes équipes, et ceux qui décident qui joue ce match.
 */
export function prerequis(vue) {
  const avant = new Map();
  const matchsDuGroupe = new Map(); // 'etape:groupe' -> identifiants
  for (const etape of vue.etapes) {
    if (etape.type === 'poules') {
      for (const g of etape.groupes) {
        matchsDuGroupe.set(`${etape.id}:${g.id}`, g.matchs.map((m) => m.id));
        for (const m of g.matchs) {
          const liste = [];
          for (const place of [m.placeA, m.placeB]) {
            // Matchs précédents de cette place dans la poule.
            for (const p of g.matchs) if (p.tour < m.tour && (p.placeA === place || p.placeB === place)) liste.push(p.id);
            // Poule d'origine : il faut son classement pour savoir qui occupe la place.
            const source = g.places[place].source;
            if (source && etape.source) liste.push(...(matchsDuGroupe.get(`${etape.source}:${source}`) || []));
          }
          avant.set(m.id, liste);
        }
      }
    } else {
      for (const t of etape.tableaux) {
        for (const m of t.matchs) {
          const liste = [];
          for (const ref of [m.refA, m.refB]) {
            if (ref.type === 'rang') liste.push(...(matchsDuGroupe.get(`${etape.source}:${ref.groupe}`) || []));
            else liste.push(ref.match);
          }
          avant.set(m.id, liste);
        }
      }
    }
  }
  return avant;
}

/**
 * Calcule le planning.
 * @param {object[]} tournois  tournois de la journée (état complet, tirage fait)
 * @param {object} r  réglages : { nbTerrains, debut: '09:00', fin: '18:00', duree, battement, pause, rythme: { M: 3, F: 1 } }
 *   duree = minutes de jeu ; battement = minutes entre deux matchs sur un terrain ;
 *   pause = repos minimal d'une équipe entre deux matchs ;
 *   rythme = nombre de tours de chaque tournoi avant de passer à l'autre (3 tours masculins pour 1 féminin).
 * @returns {{ creneaux: object, debut: string, fin: string, depasse: boolean, nbMatchs: number, grille: object[] }}
 */
export function planifier(tournois, r) {
  const pas = Math.max(1, r.duree + r.battement);
  const ecart = Math.max(1, Math.ceil((r.pause + r.duree) / pas)); // créneaux entre deux matchs d'une même équipe
  const nbTerrains = Math.max(1, r.nbTerrains);
  const depart = enMinutes(r.debut);

  const files = tournois.map((t) => {
    const vue = calculer(t);
    return { cle: t.cle, nom: t.nom, manches: vue.manches, avant: prerequis(vue), i: 0 };
  });
  // Ordre de passage : on alterne les tournois selon le rythme demandé.
  const ordre = [];
  while (files.some((f) => f.i < f.manches.length)) {
    for (const f of files) {
      const n = Math.max(1, Number((r.rythme || {})[f.cle]) || 1);
      for (let k = 0; k < n && f.i < f.manches.length; k++) ordre.push({ f, manche: f.manches[f.i++] });
    }
  }

  const occupation = []; // créneau -> nombre de terrains pris
  const creneauDe = new Map();
  const creneaux = Object.fromEntries(tournois.map((t) => [t.cle, {}]));
  const grille = [];
  for (const { f, manche } of ordre) {
    for (const m of manche.matchs) {
      let s = 0;
      for (const id of f.avant.get(m.id) || []) s = Math.max(s, (creneauDe.get(`${f.cle}|${id}`) ?? -ecart) + ecart);
      while ((occupation[s] || 0) >= nbTerrains) s++;
      occupation[s] = (occupation[s] || 0) + 1;
      creneauDe.set(`${f.cle}|${m.id}`, s);
      const heure = enHeure(depart + s * pas);
      creneaux[f.cle][m.id] = { lieu: occupation[s], heure };
      grille.push({ creneau: s, heure, lieu: occupation[s], tournoi: f.cle, nomTournoi: f.nom, match: m.id, libelle: `${manche.nomEtape} ${manche.tour}, ${m.libelle}` });
    }
  }
  const dernier = occupation.length ? depart + (occupation.length - 1) * pas + r.duree : depart;
  grille.sort((x, y) => x.creneau - y.creneau || x.lieu - y.lieu);
  return { creneaux, debut: enHeure(depart), fin: enHeure(dernier), depasse: dernier > enMinutes(r.fin), nbMatchs: grille.length, nbCreneaux: occupation.length, grille };
}

/**
 * Compte les matchs d'une formule pour n équipes, sans rien jouer :
 * sert à comparer les formules de la quinte féminine avant de choisir.
 */
export function compterMatchs({ format, variante = null, n, parametres = {} }) {
  let t = creerTournoi({ format, variante, parametres });
  t = definirEquipes(t, Array.from({ length: n }, () => ({}))).tournoi;
  t = tirerAuSort(t, 1).tournoi;
  const vue = calculer(t);
  // Nombre de matchs par équipe : chaque étape de poules donne (taille de la poule - 1) matchs,
  // puis de 1 match (éliminée d'entrée) au nombre de tours du tableau.
  const poules = vue.etapes.filter((e) => e.type === 'poules');
  const tailles = (e) => e.groupes.map((g) => g.places.length - 1);
  const toursTableau = Math.max(0, ...vue.etapes.filter((e) => e.type === 'tableaux').flatMap((e) => e.tableaux.flatMap((x) => x.matchs.map((m) => m.tour))));
  return {
    total: vue.matchs.length,
    tours: vue.manches.length,
    parEquipeMin: poules.reduce((somme, e) => somme + Math.min(...tailles(e)), 0) + (toursTableau ? 1 : 0),
    parEquipeMax: poules.reduce((somme, e) => somme + Math.max(...tailles(e)), 0) + toursTableau,
  };
}
