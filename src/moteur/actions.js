// Toutes les modifications de l'état d'un tournoi, en fonctions pures.
// Chaque action reçoit un tournoi et en retourne un NOUVEAU, avec une « trace » pour le journal.
// L'interface ajoute la date et l'opérateur à la trace : le moteur n'a pas d'horloge.
//
// Forme d'un tournoi :
// {
//   cle: 'principal',            identifiant dans l'événement ('M' et 'F' pour la quinte)
//   nom, format, variante,       format = identifiant d'un fichier de src/formats
//   parametres: {},              réglages qui remplacent les défauts du format
//   equipes: [{ id, nom, joueurs: [], present }],
//   tirage: { graine, poules: [[id, id...], ...] } ou null,
//   demarre: false,              vrai dès le premier score : le tirage est alors verrouillé
//   scores: { idMatch: { a, b, vainqueur?, forfait? } },
//   departages: { 'etape:poule': [id, id...] }   ordre décidé par la table en cas d'égalité parfaite
//   echanges: { idEtape: [[idA, idB], ...] }     échanges manuels dans les poules d'une étape
//   lieux: { idMatch: numéro }                   planche ou terrain corrigé à la main
//   creneaux: { idMatch: { lieu, heure } }       planning horaire (quinte)
// }

import { creerAlea, melanger } from './aleatoire.js';
import { taillesPoules } from './poules.js';
import { calculer, parametresDe } from './tournoi.js';
import { formatDe } from '../formats/index.js';

export function creerTournoi({ format, nom, cle = 'principal', variante = null, parametres = {} }) {
  const f = formatDe(format);
  return {
    cle, nom: nom || f.nom, format, variante, parametres,
    equipes: [], tirage: null, demarre: false,
    scores: {}, departages: {}, echanges: {}, lieux: {}, creneaux: {},
  };
}

/** Nom affiché d'une équipe : son nom, sinon le joueur 1, sinon « Équipe N ». */
export function nomEquipe(equipe) {
  if (!equipe) return '';
  return (equipe.nom && equipe.nom.trim()) || (equipe.joueurs && equipe.joueurs[0] && equipe.joueurs[0].trim()) || `Équipe ${equipe.id}`;
}

/**
 * Lit une liste collée depuis un tableur ou tapée à la main : une équipe par ligne.
 * Colonnes séparées par tabulation ou point-virgule : nom d'équipe, joueur 1, joueur 2...
 * Si la première colonne est un numéro, elle est ignorée (les numéros sont réattribués dans l'ordre).
 */
export function lireListeEquipes(texte) {
  const equipes = [];
  for (const brute of String(texte || '').split(/\r?\n/)) {
    let colonnes = brute.split(/\t|;/).map((c) => c.trim());
    if (colonnes.every((c) => c === '')) continue;
    if (/^\d+$/.test(colonnes[0]) && colonnes.length > 1) colonnes = colonnes.slice(1);
    const [nom, ...joueurs] = colonnes;
    equipes.push({ id: equipes.length + 1, nom: nom || '', joueurs: joueurs.filter(Boolean), present: true });
  }
  return equipes;
}

export function definirEquipes(tournoi, equipes) {
  if (tournoi.demarre) throw new Error('Le tournoi a démarré : la liste des équipes ne peut plus être remplacée.');
  const liste = equipes.map((e, i) => ({ id: i + 1, nom: e.nom || '', joueurs: e.joueurs || [], present: e.present !== false }));
  return { tournoi: { ...tournoi, equipes: liste, tirage: null }, trace: { type: 'equipes', nombre: liste.length } };
}

/** Modifie le nom ou les joueurs d'une équipe (possible à tout moment : le numéro ne change pas). */
export function modifierEquipe(tournoi, id, champs) {
  const equipes = tournoi.equipes.map((e) => (e.id === id ? { ...e, ...champs, id } : e));
  return { tournoi: { ...tournoi, equipes }, trace: { type: 'equipe', equipe: id } };
}

/** Tirage au sort de la première étape. Le résultat est enregistré : il ne change plus à l'actualisation. */
export function tirerAuSort(tournoi, graine) {
  if (tournoi.demarre) throw new Error('Le tournoi a démarré : le tirage ne peut plus être relancé.');
  const presents = tournoi.equipes.filter((e) => e.present !== false).map((e) => e.id);
  if (presents.length < 2) throw new Error('Il faut au moins 2 équipes présentes pour tirer les poules.');
  const P = parametresDe(tournoi);
  const ordre = melanger(presents, creerAlea(graine));
  const poules = [];
  let debut = 0;
  // nbPoules (quinte féminine) impose le nombre de poules ; sinon on vise la taille de poule réglée.
  const k = P.nbPoules ? Math.min(P.nbPoules, Math.floor(ordre.length / 2) || 1) : 0;
  const tailles = k
    ? Array.from({ length: k }, (_, i) => Math.floor(ordre.length / k) + (i < ordre.length % k ? 1 : 0))
    : taillesPoules(ordre.length, P.taillePoule);
  for (const taille of tailles) {
    poules.push(ordre.slice(debut, debut + taille));
    debut += taille;
  }
  return { tournoi: { ...tournoi, tirage: { graine, poules } }, trace: { type: 'tirage', graine, equipes: ordre.length, poules: poules.length } };
}

/** Échange deux équipes dans le tirage (correction manuelle avant le début des matchs). */
export function echangerDansTirage(tournoi, a, b) {
  if (tournoi.demarre) throw new Error('Le tournoi a démarré : le tirage ne peut plus être modifié.');
  if (!tournoi.tirage) throw new Error("Le tirage n'a pas encore été fait.");
  const poules = tournoi.tirage.poules.map((p) => p.map((id) => (id === a ? b : id === b ? a : id)));
  return { tournoi: { ...tournoi, tirage: { ...tournoi.tirage, poules } }, trace: { type: 'echange-tirage', equipes: [a, b] } };
}

/** Échange deux équipes dans les poules d'une étape suivante (reste possible à la main, avec contrôle). */
export function echangerDansEtape(tournoi, etape, a, b) {
  const liste = [...((tournoi.echanges || {})[etape] || []), [a, b]];
  return { tournoi: { ...tournoi, echanges: { ...tournoi.echanges, [etape]: liste } }, trace: { type: 'echange-etape', etape, equipes: [a, b] } };
}

export function annulerEchanges(tournoi, etape) {
  const echanges = { ...tournoi.echanges };
  delete echanges[etape];
  return { tournoi: { ...tournoi, echanges }, trace: { type: 'annulation-echanges', etape } };
}

const estScore = (x) => Number.isInteger(x) && x >= 0;

/**
 * Enregistre le score d'un match.
 * @param {object} score { a, b } et, en phase finale si égalité, vainqueur: 'a' ou 'b' (départage sur le terrain)
 */
export function saisirScore(tournoi, idMatch, score) {
  const vue = calculer(tournoi);
  const match = vue.matchs.find((m) => m.id === idMatch);
  if (!match) throw new Error(`Match introuvable : ${idMatch}`);
  if (!match.pret) throw new Error("Ce match n'a pas encore ses deux équipes.");
  if (!estScore(score.a) || !estScore(score.b)) throw new Error('Les deux scores doivent être des nombres entiers positifs.');
  const propre = { a: score.a, b: score.b };
  if (score.forfait === 'a' || score.forfait === 'b') propre.forfait = score.forfait;
  if (match.type === 'tableau' && score.a === score.b) {
    if (score.vainqueur !== 'a' && score.vainqueur !== 'b') {
      throw new Error(`Match nul impossible en phase finale. ${vue.parametres.departageFinale}, puis indiquer le vainqueur.`);
    }
    propre.vainqueur = score.vainqueur;
  }
  const ancien = (tournoi.scores || {})[idMatch] || null;
  if (ancien && vue.parametres.correctionScore === 'interdite') {
    throw new Error('Ce score est déjà saisi et les corrections sont interdites pour ce tournoi (voir Paramètres).');
  }
  return {
    tournoi: { ...tournoi, demarre: true, scores: { ...tournoi.scores, [idMatch]: propre } },
    trace: { type: ancien ? 'correction' : 'score', match: idMatch, libelle: `${match.nomEtape}, tour ${match.tour}, ${match.libelle}`, ancien, nouveau: propre },
  };
}

/** Forfait : l'équipe `cote` ('a' ou 'b') est absente, le score prévu par les paramètres est enregistré. */
export function declarerForfait(tournoi, idMatch, cote) {
  const P = parametresDe(tournoi);
  const score = cote === 'a'
    ? { a: P.forfait.contre, b: P.forfait.pour, forfait: 'a' }
    : { a: P.forfait.pour, b: P.forfait.contre, forfait: 'b' };
  return saisirScore(tournoi, idMatch, score);
}

/** Efface un score saisi par erreur (soumis à la même règle que les corrections). */
export function effacerScore(tournoi, idMatch) {
  const ancien = (tournoi.scores || {})[idMatch];
  if (!ancien) return { tournoi, trace: null };
  if (parametresDe(tournoi).correctionScore === 'interdite') throw new Error('Les corrections sont interdites pour ce tournoi (voir Paramètres).');
  const scores = { ...tournoi.scores };
  delete scores[idMatch];
  return { tournoi: { ...tournoi, scores }, trace: { type: 'effacement', match: idMatch, ancien, nouveau: null } };
}

/**
 * Égalité parfaite : la table de marque indique l'ordre des équipes concernées après départage sur le terrain.
 * @param {string} cle    'etape:poule'
 * @param {number[]} ordre équipes à égalité, de la mieux classée à la moins bien classée
 */
export function trancherEgalite(tournoi, cle, ordre) {
  const deja = ((tournoi.departages || {})[cle] || []).filter((id) => !ordre.includes(id));
  return {
    tournoi: { ...tournoi, departages: { ...tournoi.departages, [cle]: [...deja, ...ordre] } },
    trace: { type: 'departage', poule: cle, ordre },
  };
}

/** Change la planche ou le terrain d'un match. */
export function definirLieu(tournoi, idMatch, lieu) {
  const lieux = { ...tournoi.lieux };
  if (lieu == null || lieu === '') delete lieux[idMatch];
  else lieux[idMatch] = Number(lieu);
  return { tournoi: { ...tournoi, lieux }, trace: { type: 'lieu', match: idMatch, lieu } };
}

/** Change la variante du format (quinte féminine). Le tirage est à refaire : la structure change. */
export function choisirVariante(tournoi, variante) {
  if (tournoi.demarre) throw new Error('Le tournoi a démarré : la formule ne peut plus changer.');
  return { tournoi: { ...tournoi, variante, tirage: null, creneaux: {} }, trace: { type: 'variante', variante } };
}

/** Enregistre le planning horaire calculé (terrain et heure de chaque match). */
export function definirCreneaux(tournoi, creneaux) {
  return { tournoi: { ...tournoi, creneaux }, trace: { type: 'planning' } };
}

/** Change les paramètres du tournoi (barème, critères, score cible...). Les classements suivent aussitôt. */
export function modifierParametres(tournoi, parametres) {
  return { tournoi: { ...tournoi, parametres: { ...tournoi.parametres, ...parametres } }, trace: { type: 'parametres', parametres } };
}
