// Chef d'orchestre du moteur : à partir de l'état d'un tournoi (équipes, tirage, scores, décisions),
// calcule tout ce qui s'affiche : poules, matchs, planches, classements, tableaux, classement final.
// Fonction pure : aucune horloge, aucun réseau, aucun affichage. Même entrée, même sortie.

import { formatDe } from '../formats/index.js';
import { calendrierPoule, lettrePoule, matchsSimultanes } from './poules.js';
import { classerPoule } from './classement.js';
import { entrantsParNiveau, repartir, conflitsMemeOrigine } from './affectation.js';
import { construireTableau, libellePlace } from './tableau.js';

/** Paramètres effectifs d'un tournoi : défauts du format, remplacés par les réglages du tournoi. */
export function parametresDe(tournoi) {
  const defauts = formatDe(tournoi.format).parametres;
  const perso = tournoi.parametres || {};
  return {
    ...defauts,
    ...perso,
    points: { ...defauts.points, ...(perso.points || {}) },
    forfait: { ...defauts.forfait, ...(perso.forfait || {}) },
  };
}

/** Étapes effectives : celles du format, ou celles choisies pour ce tournoi (variantes de la quinte). */
export function etapesDe(tournoi) {
  const format = formatDe(tournoi.format);
  if (tournoi.variante && format.variantes && format.variantes[tournoi.variante]) return format.variantes[tournoi.variante].etapes;
  return format.etapes;
}

const ordinal = (r) => (r === 1 ? '1er' : `${r}e`);

/** Lit un score saisi et dit qui gagne. En tableau, une égalité exige un départage (score.vainqueur). */
function lireResultat(score, enTableau) {
  if (!score || typeof score.a !== 'number' || typeof score.b !== 'number') return { joue: false };
  if (score.a > score.b) return { joue: true, vainqueur: 'a' };
  if (score.b > score.a) return { joue: true, vainqueur: 'b' };
  if (!enTableau) return { joue: true, vainqueur: null, nul: true };
  if (score.vainqueur === 'a' || score.vainqueur === 'b') return { joue: true, vainqueur: score.vainqueur };
  return { joue: false, attenteDepartage: true };
}

/** Construit les matchs et le classement d'une étape de poules. */
function calculerPoules(etape, groupes, ctx) {
  const { tournoi, P, scores, vue } = ctx;
  for (const g of groupes) {
    const tours = calendrierPoule(g.places.length);
    g.matchs = [];
    tours.forEach((paires, t) => {
      paires.forEach(([i, j], index) => {
        const id = `${etape.id}:${g.id}:${t + 1}:${index + 1}`;
        const a = g.places[i];
        const b = g.places[j];
        const pret = a.equipe != null && b.equipe != null;
        const score = pret ? scores[id] || null : null;
        const r = lireResultat(score, false);
        const m = {
          id, etape: etape.id, nomEtape: etape.nom, type: 'poule', groupe: g.id, nomGroupe: g.nom, niveau: g.niveau,
          tour: t + 1, index, libelle: `Poule ${g.nom}`,
          a: a.equipe, b: b.equipe, origineA: a.origine, origineB: b.origine,
          pret, score: r.joue ? score : null, joue: r.joue, vainqueur: r.vainqueur || null, nul: !!r.nul,
        };
        g.matchs.push(m);
        vue.matchs.push(m);
      });
    });
    const complete = g.places.every((p) => p.equipe != null);
    const cle = `${etape.id}:${g.id}`;
    if (complete) {
      const c = classerPoule({
        equipes: g.places.map((p) => p.equipe),
        matchs: g.matchs.map((m) => ({ a: m.a, b: m.b, score: m.score })),
        parametres: P, cle, graine: (tournoi.tirage && tournoi.tirage.graine) || 0,
        decision: (tournoi.departages || {})[cle] || null,
      });
      g.classement = c.lignes;
      g.terminee = c.terminee;
      g.egalites = c.egalites;
      for (const e of c.egalites) {
        if (!e.resolue) vue.alertes.push({ type: 'egalite', cle, etape: etape.id, nomEtape: etape.nom, groupe: g.id, nomGroupe: g.nom, equipes: e.equipes });
      }
    } else {
      g.classement = [];
      g.terminee = false;
      g.egalites = [];
    }
  }
}

/** Compose les poules d'une étape à partir du classement de l'étape précédente. */
function composerDepuisEtape(etape, precedente, ctx) {
  const { tournoi, P, vue } = ctx;
  const niveaux = etape.niveaux || [{ id: 'N', nom: '', prefixe: 'N', rangs: [] }];
  const sources = precedente.groupes.map((g) => ({ id: g.id, taille: g.places.length }));
  const sourceParId = new Map(precedente.groupes.map((g) => [g.id, g]));
  const origine = new Map(); // équipe -> poule de l'étape précédente
  for (const g of precedente.groupes) for (const p of g.places) if (p.equipe != null) origine.set(p.equipe, g.id);

  const groupes = [];
  entrantsParNiveau(sources, niveaux).forEach((entrants, n) => {
    const niveau = niveaux[n];
    repartir(entrants, etape.repartition, P.taillePoule).forEach((liste, i) => {
      const places = liste.map((e) => {
        const src = sourceParId.get(e.groupe);
        const ligne = src.terminee ? src.classement[e.rang - 1] : null;
        return { equipe: ligne ? ligne.equipe : null, origine: `${ordinal(e.rang)} ${src.nom}` };
      });
      groupes.push({ id: `${niveau.prefixe}${i + 1}`, nom: `${niveau.prefixe}${i + 1}`, niveau: niveau.id, nomNiveau: niveau.nom, places });
    });
  });

  // Échanges décidés à la main par la table de marque (appliqués quand les deux équipes sont placées).
  for (const [x, y] of (tournoi.echanges || {})[etape.id] || []) {
    const toutes = groupes.flatMap((g) => g.places);
    const px = toutes.find((p) => p.equipe === x);
    const py = toutes.find((p) => p.equipe === y);
    if (px && py) { px.equipe = y; py.equipe = x; px.modifie = true; py.modifie = true; }
  }

  // Contrôle : deux équipes d'une même poule d'origine ne doivent pas être réunies.
  const parNiveau = new Map();
  for (const g of groupes) parNiveau.set(g.niveau, (parNiveau.get(g.niveau) || 0) + 1);
  for (const g of groupes) {
    if (parNiveau.get(g.niveau) < 2) continue; // une seule poule dans le niveau : inévitable
    for (const [a, b] of conflitsMemeOrigine(g.places.map((p) => p.equipe), origine)) {
      vue.alertes.push({ type: 'meme-poule', etape: etape.id, nomEtape: etape.nom, groupe: g.id, nomGroupe: g.nom, equipes: [a, b], origine: origine.get(a) });
    }
  }
  return groupes;
}

/** Construit les tableaux finaux (un par niveau) et branche les équipes au fil des résultats. */
function calculerTableaux(etape, precedente, ctx) {
  const { P, scores, vue } = ctx;
  const niveaux = [];
  for (const g of precedente.groupes) {
    let n = niveaux.find((x) => x.id === g.niveau);
    if (!n) { n = { id: g.niveau, nom: g.nomNiveau || 'Tableau final', poules: [] }; niveaux.push(n); }
    n.poules.push(g);
  }
  const groupeParId = new Map(precedente.groupes.map((g) => [g.id, g]));
  const matchParId = new Map();
  const tableaux = [];

  const resoudre = (ref) => {
    if (ref.type === 'rang') {
      const g = groupeParId.get(ref.groupe);
      const ligne = g.terminee ? g.classement[ref.rang - 1] : null;
      return { equipe: ligne ? ligne.equipe : null, origine: `${ordinal(ref.rang)} ${g.nom}` };
    }
    const m = matchParId.get(ref.match);
    const gagnant = m.vainqueur === 'a' ? m.a : m.vainqueur === 'b' ? m.b : null;
    const perdant = m.vainqueur === 'a' ? m.b : m.vainqueur === 'b' ? m.a : null;
    return ref.type === 'vainqueur'
      ? { equipe: gagnant, origine: `Vainqueur ${m.libelle}` }
      : { equipe: perdant, origine: `Perdant ${m.libelle}` };
  };

  for (const niveau of niveaux) {
    const structure = construireTableau({
      prefixe: `${etape.id}:${niveau.id}`,
      poules: niveau.poules.map((g) => ({ id: g.id, taille: g.places.length })),
      qualifies: P.qualifiesParPoule,
      matchsClassement: P.matchsClassement,
    });
    const matchs = structure.matchs.map((s) => {
      const a = resoudre(s.a);
      const b = resoudre(s.b);
      const pret = a.equipe != null && b.equipe != null;
      const score = pret ? scores[s.id] || null : null;
      const r = lireResultat(score, true);
      const m = {
        id: s.id, etape: etape.id, nomEtape: etape.nom, type: 'tableau', niveau: niveau.id, nomNiveau: niveau.nom,
        tour: s.tour, principal: !!s.principal, libelle: s.libelle,
        a: a.equipe, b: b.equipe, origineA: a.origine, origineB: b.origine,
        pret, score: r.joue || r.attenteDepartage ? score : null, joue: r.joue, vainqueur: r.vainqueur || null,
        nul: false, attenteDepartage: !!r.attenteDepartage,
      };
      matchParId.set(m.id, m);
      vue.matchs.push(m);
      return m;
    });
    const nbEquipes = niveau.poules.reduce((s, g) => s + g.places.length, 0);
    tableaux.push({ niveau: niveau.id, nom: niveau.nom, matchs, nbEquipes, paliers: structure.paliers.map((p) => p.map(resoudre)) });
  }
  return tableaux;
}

/** Attribue une planche (ou un terrain) à chaque match. Reprend la numérotation des Sheets du club. */
function attribuerLieux(vue, tournoi, P) {
  const nb = Math.max(1, P.nbLieux || 1);
  const poser = (m, brut) => { m.vague = Math.floor(brut / nb) + 1; m.lieu = (brut % nb) + 1; };
  for (const etape of vue.etapes) {
    if (etape.type === 'poules') {
      // Chaque poule garde ses planches pendant toute l'étape : poule A = planches 1 et 2, poule B = 3 et 4...
      let base = 0;
      for (const g of etape.groupes) {
        for (const m of g.matchs) poser(m, base + m.index);
        base += matchsSimultanes(g.places.length);
      }
    } else {
      // Chaque niveau garde son bloc de planches : Principale 1 à 8, niveau suivant 9 à 16...
      let base = 0;
      for (const t of etape.tableaux) {
        const parTour = new Map();
        for (const m of t.matchs) {
          const i = parTour.get(m.tour) || 0;
          poser(m, base + i);
          parTour.set(m.tour, i + 1);
        }
        base += Math.max(0, ...parTour.values());
      }
    }
  }
  // Créneaux horaires (quinte) et corrections manuelles de la table de marque.
  const creneaux = tournoi.creneaux || {};
  const lieux = tournoi.lieux || {};
  for (const m of vue.matchs) {
    if (creneaux[m.id]) { m.lieu = creneaux[m.id].lieu; m.heure = creneaux[m.id].heure; m.vague = 1; }
    if (lieux[m.id] != null) m.lieu = lieux[m.id];
  }
}

/** Liste les manches (une étape + un tour) dans l'ordre du tournoi, avec leur avancement. */
function listerManches(vue) {
  const manches = [];
  for (const etape of vue.etapes) {
    const matchs = vue.matchs.filter((m) => m.etape === etape.id);
    const tours = [...new Set(matchs.map((m) => m.tour))].sort((x, y) => x - y);
    for (const tour of tours) {
      const liste = matchs.filter((m) => m.tour === tour);
      manches.push({
        etape: etape.id, nomEtape: etape.nom, tour, matchs: liste,
        prete: liste.every((m) => m.pret), terminee: liste.every((m) => m.joue),
        joues: liste.filter((m) => m.joue).length,
      });
    }
  }
  return manches;
}

/** Classement final : places par niveau, puis classement général en enchaînant les niveaux. */
function classementFinal(vue) {
  const derniere = vue.etapes[vue.etapes.length - 1];
  if (!derniere) return [];
  const lignes = [];
  let decalage = 0;
  if (derniere.type === 'tableaux') {
    for (const t of derniere.tableaux) {
      let position = 1;
      for (const palier of t.paliers) {
        for (const r of palier) {
          lignes.push({
            niveau: t.nom, placeNiveau: libellePlace(position, palier.length),
            place: libellePlace(decalage + position, palier.length), equipe: r.equipe, origine: r.origine,
          });
        }
        position += palier.length;
      }
      decalage += t.nbEquipes;
    }
    return lignes;
  }
  // Dernière étape en poules (toutes contre toutes, par exemple) : le rang de poule donne la place.
  const niveaux = [...new Set(derniere.groupes.map((g) => g.niveau))];
  for (const niveau of niveaux) {
    const groupes = derniere.groupes.filter((g) => g.niveau === niveau);
    const rangMax = Math.max(0, ...groupes.map((g) => g.places.length));
    let position = 1;
    for (let rang = 1; rang <= rangMax; rang++) {
      const concernes = groupes.filter((g) => g.places.length >= rang);
      for (const g of concernes) {
        const ligne = g.terminee ? g.classement[rang - 1] : null;
        lignes.push({
          niveau: g.nomNiveau || '', placeNiveau: libellePlace(position, concernes.length),
          place: libellePlace(decalage + position, concernes.length), equipe: ligne ? ligne.equipe : null,
          origine: `${ordinal(rang)} ${g.nom}`,
        });
      }
      position += concernes.length;
    }
    decalage += groupes.reduce((s, g) => s + g.places.length, 0);
  }
  return lignes;
}

/**
 * Calcule la vue complète d'un tournoi.
 * @param {object} tournoi  état du tournoi (voir src/moteur/actions.js pour sa forme)
 * @returns {object} vue : { parametres, format, etapes, matchs, manches, alertes, classementFinal, mancheCourante }
 */
export function calculer(tournoi) {
  const format = formatDe(tournoi.format);
  const P = parametresDe(tournoi);
  const vue = { format, parametres: P, etapes: [], matchs: [], manches: [], alertes: [], classementFinal: [], mancheCourante: null };
  if (!tournoi.tirage || !tournoi.tirage.poules) return vue;
  const ctx = { tournoi, P, scores: tournoi.scores || {}, vue };
  const presents = new Set((tournoi.equipes || []).map((e) => e.id));

  for (const def of etapesDe(tournoi)) {
    const precedente = def.source ? vue.etapes.find((e) => e.id === def.source) : null;
    if (def.type === 'poules') {
      let groupes;
      if (!precedente) {
        // Première étape : poules issues du tirage au sort enregistré.
        groupes = tournoi.tirage.poules.map((ids, i) => ({
          id: lettrePoule(i), nom: lettrePoule(i), niveau: 'N', nomNiveau: '',
          places: ids.filter((id) => presents.has(id)).map((id) => ({ equipe: id, origine: '' })),
        })).filter((g) => g.places.length > 0);
      } else groupes = composerDepuisEtape(def, precedente, ctx);
      calculerPoules(def, groupes, ctx);
      vue.etapes.push({ id: def.id, nom: def.nom, type: 'poules', groupes });
    } else if (def.type === 'tableaux') {
      const tableaux = calculerTableaux(def, precedente, ctx);
      vue.etapes.push({ id: def.id, nom: def.nom, type: 'tableaux', tableaux });
    }
  }

  attribuerLieux(vue, tournoi, P);
  vue.manches = listerManches(vue);
  vue.mancheCourante = vue.manches.find((m) => !m.terminee) || null;
  vue.classementFinal = classementFinal(vue);
  vue.termine = vue.manches.length > 0 && vue.manches.every((m) => m.terminee);
  return vue;
}
