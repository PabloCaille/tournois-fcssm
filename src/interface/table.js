// Table de marque : état de la page, enregistrement, publication et réactions aux clics.
// Le HTML des sections est dans table-vues.js, les règles sportives dans src/moteur.

import { MODELES } from '../formats/index.js';
import { calculer } from '../moteur/tournoi.js';
import * as actions from '../moteur/actions.js';
import { nouvelleGraine, creerAlea } from '../moteur/aleatoire.js';
import { jouerMancheCourante } from '../moteur/simulation.js';
import { creerEvenement, identifiantDepuisNom, appliquer, modifierEvenement } from '../donnees/evenement.js';
import * as stockage from '../donnees/stockage.js';
import { h, annuaire, htmlMatch, htmlPoule, htmlClassementFinal, htmlQr, destinations, nomManche, adressePage, texteEquipe } from './rendu.js';
import * as vues from './table-vues.js';
import { vuePlanning, actionsPlanning } from './table-planning.js';

const etat = {
  evenement: null,
  cle: null, // tournoi affiché (un événement peut en contenir plusieurs)
  onglet: 'saisie',
  etapeTirage: null, choixTirage: null,
  mancheVue: null, etapeClassement: null,
  saisie: { match: null, a: null, b: null, controle: false },
  ordreEgalite: {},
  operateur: stockage.lireReglage('operateur', ''),
  code: stockage.lireReglage('code', ''),
  liaison: { date: null, erreur: null, enCours: false, aRefaire: false },
};

const $ = (selecteur) => document.querySelector(selecteur);
const maintenant = () => ({ date: new Date().toISOString(), qui: etat.operateur });
const tournoiCourant = () => etat.evenement.tournois.find((t) => t.cle === etat.cle) || etat.evenement.tournois[0];
const estDemo = () => etat.evenement && etat.evenement.id.startsWith('demo-');

// ---------- Messages ----------
let minuterieMessage = null;
function dire(texte, erreur = false) {
  const boite = $('#message');
  boite.textContent = texte;
  boite.className = erreur ? 'erreur' : '';
  boite.hidden = false;
  clearTimeout(minuterieMessage);
  minuterieMessage = setTimeout(() => { boite.hidden = true; }, erreur ? 7000 : 2500);
}

// ---------- Enregistrement et publication ----------
function enregistrer(evenement, libelle) {
  etat.evenement = evenement;
  stockage.ecrireLocal(evenement, libelle);
  publier();
  rendre();
}

/** Publie en ligne sans bloquer la saisie. Si une publication est déjà en cours, on republie juste après. */
async function publier() {
  if (!stockage.enLigneConfigure() || !etat.code || !etat.evenement) return;
  if (etat.liaison.enCours) { etat.liaison.aRefaire = true; return; }
  etat.liaison.enCours = true;
  try {
    await stockage.ecrireEnLigne(etat.evenement, etat.code);
    etat.liaison.date = new Date().toISOString();
    etat.liaison.erreur = null;
  } catch (e) {
    etat.liaison.erreur = e.message || 'connexion impossible.';
  }
  etat.liaison.enCours = false;
  rendreMenu();
  if (etat.liaison.aRefaire) { etat.liaison.aRefaire = false; publier(); }
}

/** Applique une action du moteur au tournoi courant, avec message en cas de refus. */
function agir(action, libelle, message = '') {
  try {
    enregistrer(appliquer(etat.evenement, tournoiCourant().cle, action, maintenant()), libelle);
    if (message) dire(message);
    return true;
  } catch (e) {
    dire(e.message, true);
    return false;
  }
}

function ouvrir(evenement) {
  etat.evenement = evenement;
  etat.cle = evenement.tournois[0].cle;
  etat.saisie = { match: null, a: null, b: null, controle: false };
  etat.mancheVue = null; etat.etapeClassement = null; etat.etapeTirage = null;
  const t = evenement.tournois[0];
  etat.onglet = !t.equipes.length ? 'equipes' : !t.tirage ? 'tirage' : 'saisie';
  history.replaceState(null, '', `?t=${encodeURIComponent(evenement.id)}`);
  rendre();
  publier();
}

// ---------- Affichage ----------
const ONGLETS = [
  ['equipes', 'Équipes'], ['tirage', 'Tirage'], ['saisie', 'Saisie'], ['classements', 'Classements'],
  ['planning', 'Planning'], ['diffusion', 'Diffusion'], ['journal', 'Journal'], ['parametres', 'Paramètres'],
];

function contexte() {
  const tournoi = tournoiCourant();
  return { etat, evenement: etat.evenement, tournoi, vue: calculer(tournoi), equipes: annuaire(tournoi), demo: estDemo() };
}

function rendreMenu(ctx = null) {
  const menu = $('#menu');
  if (!etat.evenement) { menu.innerHTML = '<div class="titre">Tournois FCSSM<small>Table de marque</small></div>'; return; }
  const c = ctx || contexte();
  const nbAlertes = etat.evenement.tournois.reduce((n, t) => n + calculer(t).alertes.filter((a) => a.type === 'egalite').length, 0);
  const choixTournoi = etat.evenement.tournois.length > 1
    ? `<select data-change="changer-tournoi" aria-label="Tournoi">${etat.evenement.tournois.map((t) => `<option value="${h(t.cle)}"${t.cle === c.tournoi.cle ? ' selected' : ''}>${h(t.nom)}</option>`).join('')}</select>` : '';
  const boutons = ONGLETS.filter(([id]) => id !== 'planning' || etat.evenement.planning)
    .map(([id, nom]) => `<button data-action="onglet" data-id="${id}"${etat.onglet === id ? ' aria-current="page"' : ''}>${nom}${id === 'saisie' && nbAlertes ? `<span class="badge">${nbAlertes}</span>` : ''}</button>`).join('');
  const liaison = !stockage.enLigneConfigure() ? 'Mode local'
    : !etat.code ? 'En ligne : code à saisir (Diffusion)'
    : etat.liaison.erreur ? 'En ligne : échec, voir Diffusion' : etat.liaison.date ? 'En ligne : à jour' : 'En ligne : en attente';
  menu.innerHTML = `<div class="titre">${h(etat.evenement.nom)}<small>Table de marque</small></div>${choixTournoi}${boutons}
    <div class="bas"><label for="operateur" style="font-weight:400">Opérateur</label><input type="text" id="operateur" value="${h(etat.operateur)}" data-change="operateur" placeholder="Votre prénom" style="width:100%;padding:4px 6px"><p style="margin-top:8px">${liaison}</p></div>`;
}

function rendre() {
  const contenu = $('#contenu');
  if (!etat.evenement) { rendreMenu(); contenu.innerHTML = vues.vueAccueil(); return; }
  const ctx = contexte();
  rendreMenu(ctx);
  const sections = {
    equipes: vues.vueEquipes, tirage: vues.vueTirage, saisie: vues.vueSaisie, classements: vues.vueClassements,
    diffusion: vues.vueDiffusion, journal: vues.vueJournal, parametres: vues.vueParametres, planning: vuePlanning,
  };
  contenu.innerHTML = (sections[etat.onglet] || vues.vueSaisie)(ctx);
  if (etat.onglet === 'saisie') {
    const cible = etat.saisie.controle ? $('#bouton-valider') : etat.saisie.match ? $('#score-a') : $('#numero-planche');
    if (cible) { cible.focus(); if (cible.select) cible.select(); }
  }
}

// ---------- Saisie ----------
/** Trouve le match à saisir pour un numéro de planche : d'abord dans la manche affichée, puis ailleurs. */
function trouverMatch(vue, numero) {
  const affichee = vue.manches.find((x) => `${x.etape}:${x.tour}` === etat.mancheVue) || vue.mancheCourante;
  const candidats = (manche) => manche.matchs.filter((m) => m.lieu === numero && m.pret).sort((x, y) => x.vague - y.vague);
  if (affichee) {
    const liste = candidats(affichee);
    const libre = liste.find((m) => !m.joue);
    if (libre) return libre;
    if (liste.length && affichee !== vue.mancheCourante) return liste[0];
  }
  for (const manche of vue.manches) {
    const libre = candidats(manche).find((m) => !m.joue);
    if (libre) return libre;
  }
  return affichee ? candidats(affichee)[0] || null : null;
}

function lireScores() {
  const a = $('#score-a').value.trim();
  const b = $('#score-b').value.trim();
  if (a === '' || b === '') return null;
  return { a: Number(a), b: Number(b) };
}

// ---------- Impressions et exports ----------
function imprimer(quoi, id) {
  const { tournoi, vue, equipes, evenement } = contexte();
  let html = `<h1>${h(evenement.nom)}</h1>`;
  if (quoi === 'poules') {
    const etape = vue.etapes.find((e) => e.id === id);
    html += `<h2>${h(etape.nom)}</h2><div class="poules">${etape.groupes.map((g) => htmlPoule(g, equipes, vue, { destination: destinations(tournoi, vue, etape.id), joueurs: true })).join('')}</div>`;
  } else if (quoi === 'manche') {
    const manche = vue.manches.find((x) => `${x.etape}:${x.tour}` === id);
    const tries = manche.matchs.slice().sort((x, y) => x.vague - y.vague || x.lieu - y.lieu);
    html += `<h2>${h(nomManche(manche))}</h2><div class="liste-matchs">${tries.map((m) => htmlMatch(m, equipes, { info: h(m.libelle) })).join('')}</div>`;
  } else if (quoi === 'final') {
    html += `<h2>Classement final</h2>${htmlClassementFinal(vue, equipes)}`;
  } else if (quoi === 'qr') {
    html += `<h2>Suivez le tournoi sur votre téléphone</h2><div style="width:320px">${htmlQr(adressePage('index.html', evenement.id)).replace('<svg', '<svg style="width:300px;height:300px"')}</div><p>${h(adressePage('index.html', evenement.id))}</p>`;
  }
  $('#impression').innerHTML = html;
  window.print();
}

function telecharger(nom, contenu, type) {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([contenu], { type }));
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
}

function exporterCsv() {
  const { vue, equipes, evenement } = contexte();
  const lignes = [['Place', 'Numéro', 'Équipe', 'Joueurs', 'Niveau', 'Place dans le niveau']];
  for (const l of vue.classementFinal) {
    const e = equipes.get(l.equipe);
    lignes.push([l.place, l.equipe ?? '', e ? actions.nomEquipe(e) : '', e ? (e.joueurs || []).join(', ') : '', l.niveau, l.placeNiveau]);
  }
  const csv = lignes.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  telecharger(`classement-${evenement.id}.csv`, `﻿${csv}`, 'text/csv;charset=utf-8');
}

// ---------- Création ----------
function creerDepuisModele(idModele, nom, prefixeId = '') {
  const modele = MODELES.find((m) => m.id === idModele) || MODELES[0];
  const tournois = modele.tournois.map((t) => actions.creerTournoi({ format: t.format, cle: t.cle, nom: t.nom, variante: t.variante || null }));
  let id = prefixeId + identifiantDepuisNom(nom || modele.nomDefaut);
  const pris = stockage.listerLocal().map((e) => e.id);
  for (let i = 2; pris.includes(id); i++) id = `${prefixeId}${identifiantDepuisNom(nom || modele.nomDefaut)}-${i}`;
  const evenement = creerEvenement({ id, nom: nom || modele.nomDefaut, tournois, planning: modele.planning ? { ...modele.planning } : null });
  return modifierEvenement(evenement, {}, { type: 'creation' }, maintenant());
}

// ---------- Réactions aux clics ----------
const reactions = {
  onglet: (el) => { etat.onglet = el.dataset.id; etat.choixTirage = null; rendre(); },
  creer: () => {
    const evenement = creerDepuisModele($('#nouveau-modele').value, $('#nouveau-nom').value.trim());
    stockage.ecrireLocal(evenement, 'Création');
    ouvrir(evenement);
  },
  demo: () => {
    const modele = MODELES.find((m) => m.id === $('#demo-modele').value) || MODELES[0];
    const n = Math.max(4, Math.min(200, Number($('#demo-nombre').value) || 64));
    let evenement = creerDepuisModele(modele.id, `Démonstration ${modele.nom}`, 'demo-');
    evenement.tournois.forEach((t, i) => {
      const nb = i === 0 ? n : Math.max(4, Math.round(n / 3));
      evenement = appliquer(evenement, t.cle, (x) => actions.definirEquipes(x, vues.equipesFictives(nb)), maintenant());
      evenement = appliquer(evenement, t.cle, (x) => actions.tirerAuSort(x, nouvelleGraine()), maintenant());
    });
    stockage.ecrireLocal(evenement, 'Démonstration créée');
    ouvrir(evenement);
  },
  ouvrir: (el) => { const e = stockage.lireLocal(el.dataset.id); if (e) ouvrir(e); },
  'supprimer-evenement': (el) => {
    if (window.confirm('Supprimer ce tournoi de cet ordinateur ? Pensez à télécharger une sauvegarde avant.')) { stockage.supprimerLocal(el.dataset.id); rendre(); }
  },
  'recuperer-enligne': async () => {
    try {
      const e = await stockage.lireEnLigne($('#id-enligne').value.trim());
      if (!e) return dire('Aucun tournoi en ligne avec cet identifiant.', true);
      stockage.ecrireLocal(e, 'Récupéré depuis la base en ligne');
      ouvrir(e);
    } catch (err) { dire(err.message, true); }
  },
  fermer: () => { etat.evenement = null; history.replaceState(null, '', window.location.pathname); rendre(); },

  // Équipes
  'remplacer-equipes': () => {
    const liste = actions.lireListeEquipes($('#liste-equipes').value);
    if (!liste.length) return dire('La liste est vide.', true);
    const t = tournoiCourant();
    if (t.equipes.length && !window.confirm(`Remplacer les ${t.equipes.length} équipes actuelles par ces ${liste.length} équipes ? Le tirage sera à refaire.`)) return;
    agir((x) => actions.definirEquipes(x, liste), 'Liste des équipes remplacée', `${liste.length} équipes enregistrées.`);
  },
  'ajouter-equipes': () => {
    const liste = actions.lireListeEquipes($('#liste-equipes').value);
    if (!liste.length) return dire('La liste est vide.', true);
    agir((x) => actions.definirEquipes(x, [...x.equipes, ...liste]), 'Équipes ajoutées', `${liste.length} équipe(s) ajoutée(s). Le tirage est à refaire.`);
  },

  // Tirage
  tirer: () => {
    const t = tournoiCourant();
    if (t.tirage && !window.confirm('Relancer le tirage ? Les poules actuelles seront remplacées.')) return;
    if (agir((x) => actions.tirerAuSort(x, nouvelleGraine()), 'Tirage au sort', 'Poules tirées au sort.')) { etat.onglet = 'tirage'; rendre(); }
  },
  'etape-tirage': (el) => { etat.etapeTirage = el.dataset.id; etat.choixTirage = null; rendre(); },
  'choisir-tirage': (el) => {
    const id = Number(el.dataset.id);
    if (etat.choixTirage == null) { etat.choixTirage = id; rendre(); return; }
    const premier = etat.choixTirage;
    etat.choixTirage = null;
    if (premier === id) { rendre(); return; }
    const { vue } = contexte();
    const etape = vue.etapes.find((e) => e.id === etat.etapeTirage && e.type === 'poules') || vue.etapes[0];
    if (etape === vue.etapes[0]) agir((x) => actions.echangerDansTirage(x, premier, id), 'Échange dans le tirage', 'Équipes échangées.');
    else agir((x) => actions.echangerDansEtape(x, etape.id, premier, id), 'Échange manuel', 'Équipes échangées.');
  },
  'annuler-echanges': (el) => agir((x) => actions.annulerEchanges(x, el.dataset.id), 'Échanges annulés'),

  // Saisie
  manche: (el) => { etat.mancheVue = el.dataset.id; rendre(); },
  'chercher-planche': () => {
    const numero = Number($('#numero-planche').value);
    if (!numero) return;
    const m = trouverMatch(contexte().vue, numero);
    if (!m) return dire(`Aucun match à saisir sur le n° ${numero}.`, true);
    etat.saisie = { match: m.id, a: null, b: null, controle: false };
    rendre();
  },
  'ouvrir-match': (el) => { etat.saisie = { match: el.dataset.id, a: null, b: null, controle: false }; rendre(); },
  'fermer-fiche': () => { etat.saisie = { match: null, a: null, b: null, controle: false }; rendre(); },
  'controler-score': () => {
    const s = lireScores();
    if (!s) return dire('Entrez les deux scores.', true);
    if (!Number.isInteger(s.a) || !Number.isInteger(s.b) || s.a < 0 || s.b < 0) return dire('Les scores doivent être des nombres entiers positifs.', true);
    etat.saisie = { ...etat.saisie, a: s.a, b: s.b, controle: true };
    rendre();
  },
  'annuler-controle': () => { etat.saisie.controle = false; rendre(); },
  'valider-score': (el) => {
    const s = etat.saisie;
    const score = { a: s.a, b: s.b };
    if (el.dataset.vainqueur) score.vainqueur = el.dataset.vainqueur;
    const id = s.match;
    etat.saisie = { match: null, a: null, b: null, controle: false };
    if (!agir((x) => actions.saisirScore(x, id, score), `Score ${score.a} à ${score.b}`, 'Score enregistré.')) { etat.saisie = { ...s, controle: false }; rendre(); }
  },
  forfait: (el) => {
    const id = etat.saisie.match;
    if (!window.confirm('Enregistrer un forfait pour cette équipe ?')) return;
    etat.saisie = { match: null, a: null, b: null, controle: false };
    agir((x) => actions.declarerForfait(x, id, el.dataset.cote), 'Forfait', 'Forfait enregistré.');
  },
  'effacer-score': () => {
    const id = etat.saisie.match;
    if (!window.confirm('Effacer ce score ?')) return;
    etat.saisie = { match: null, a: null, b: null, controle: false };
    agir((x) => actions.effacerScore(x, id), 'Score effacé', 'Score effacé.');
  },
  'changer-lieu': () => { const id = etat.saisie.match; agir((x) => actions.definirLieu(x, id, $('#lieu-match').value), 'Changement de planche', 'Modifié.'); },
  'egalite-choisir': (el) => {
    const cle = el.dataset.cle;
    const alerte = contexte().vue.alertes.find((a) => a.type === 'egalite' && a.cle === cle);
    if (!alerte) return;
    const ordre = [...(etat.ordreEgalite[cle] || []).filter((id) => alerte.equipes.includes(id)), Number(el.dataset.id)];
    const restants = alerte.equipes.filter((id) => !ordre.includes(id));
    if (restants.length <= 1) {
      delete etat.ordreEgalite[cle];
      agir((x) => actions.trancherEgalite(x, cle, [...ordre, ...restants]), 'Égalité tranchée', 'Classement de la poule mis à jour.');
    } else { etat.ordreEgalite[cle] = ordre; rendre(); }
  },
  'egalite-recommencer': (el) => { delete etat.ordreEgalite[el.dataset.cle]; rendre(); },
  'demo-jouer': () => {
    const alea = creerAlea(nouvelleGraine());
    agir((x) => ({ tournoi: jouerMancheCourante(x, alea), trace: null }), 'Manche jouée au hasard (démonstration)');
  },

  // Classements, diffusion, journal
  'etape-classement': (el) => { etat.etapeClassement = el.dataset.id; rendre(); },
  imprimer: (el) => imprimer(el.dataset.quoi, el.dataset.id),
  'exporter-csv': exporterCsv,
  'exporter-json': () => telecharger(`sauvegarde-${etat.evenement.id}.json`, JSON.stringify(etat.evenement, null, 1), 'application/json'),
  'enregistrer-code': () => {
    etat.code = $('#code-table').value;
    stockage.ecrireReglage('code', etat.code);
    etat.liaison.erreur = null;
    publier().then(() => { rendre(); dire(etat.liaison.erreur ? `Publication refusée : ${etat.liaison.erreur}` : 'Publié en ligne.', !!etat.liaison.erreur); });
  },
  'enregistrer-duree': () => {
    const duree = Math.max(4, Math.min(120, Number($('#duree-vue').value) || 15));
    enregistrer(modifierEvenement(etat.evenement, { affichage: { ...etat.evenement.affichage, duree } }, null, maintenant()), '');
    dire('Durée appliquée.');
  },
  restaurer: (el) => {
    const s = stockage.listerSauvegardes(etat.evenement.id)[Number(el.dataset.index)];
    if (!s || !window.confirm(`Revenir à l'état du ${new Date(s.date).toLocaleString('fr-FR')} (« ${s.libelle} ») ? Les saisies faites depuis seront annulées.`)) return;
    const restaure = modifierEvenement({ ...s.etat, journal: etat.evenement.journal, rev: etat.evenement.rev }, {}, { type: 'restauration', de: new Date(s.date).toLocaleString('fr-FR') }, maintenant());
    enregistrer(restaure, 'Restauration');
    dire('État restauré.');
  },
  'enregistrer-parametres': () => {
    const nombre = (id) => Number($(id).value) || 0;
    const criteres = $('#p-criteres').value.split(',').map((c) => c.trim()).filter(Boolean);
    const parametres = {
      points: { victoire: nombre('#p-victoire'), nul: nombre('#p-nul'), defaite: nombre('#p-defaite') },
      scoreCible: nombre('#p-scoreCible'), plafonnerScore: $('#p-plafonnerScore').checked,
      criteres, taillePoule: Math.max(3, nombre('#p-taillePoule')), qualifiesParPoule: Math.max(1, nombre('#p-qualifiesParPoule')),
      matchsClassement: $('#p-matchsClassement').checked, nbLieux: Math.max(1, nombre('#p-nbLieux')),
      forfait: { pour: nombre('#p-forfait-pour'), contre: nombre('#p-forfait-contre') },
      correctionScore: $('#p-correctionScore').value, afficherJoueurs: $('#p-afficherJoueurs').checked,
      dureeMatch: nombre('#p-dureeMatch'), departageFinale: $('#p-departageFinale').value.trim(),
    };
    const nom = $('#p-nom-evenement').value.trim() || etat.evenement.nom;
    etat.evenement = { ...etat.evenement, nom };
    agir((x) => actions.modifierParametres(x, parametres), 'Paramètres modifiés', 'Paramètres enregistrés, classements recalculés.');
  },
  ...actionsPlanning({ etat, $, dire, enregistrer, maintenant, rendre }),
};

const changements = {
  'modele-change': (el) => { const m = MODELES.find((x) => x.id === el.value); if (m) $('#nouveau-nom').value = m.nomDefaut; },
  operateur: (el) => { etat.operateur = el.value.trim(); stockage.ecrireReglage('operateur', etat.operateur); },
  'changer-tournoi': (el) => { etat.cle = el.value; etat.saisie = { match: null, a: null, b: null, controle: false }; etat.mancheVue = null; etat.etapeClassement = null; etat.etapeTirage = null; rendre(); },
  'equipe-nom': (el) => agir((x) => actions.modifierEquipe(x, Number(el.dataset.id), { nom: el.value.trim() }), ''),
  'equipe-joueurs': (el) => agir((x) => actions.modifierEquipe(x, Number(el.dataset.id), { joueurs: el.value.split(',').map((j) => j.trim()).filter(Boolean) }), ''),
  'equipe-present': (el) => agir((x) => {
    const r = actions.modifierEquipe(x, Number(el.dataset.id), { present: el.checked });
    return { tournoi: { ...r.tournoi, tirage: null }, trace: r.trace }; // la présence change : tirage à refaire
  }, ''),
  importer: (el) => {
    const fichier = el.files[0];
    if (!fichier) return;
    fichier.text().then((texte) => {
      const e = JSON.parse(texte);
      if (!e || !e.id || !Array.isArray(e.tournois)) throw new Error('format');
      stockage.ecrireLocal(e, 'Sauvegarde importée');
      ouvrir(e);
    }).catch(() => dire("Ce fichier n'est pas une sauvegarde de tournoi.", true));
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && reactions[el.dataset.action]) reactions[el.dataset.action](el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && changements[el.dataset.change]) changements[el.dataset.change](el, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const id = e.target.id;
  if (id === 'numero-planche') { e.preventDefault(); reactions['chercher-planche'](); }
  else if (id === 'score-a') { e.preventDefault(); $('#score-b').focus(); $('#score-b').select(); }
  else if (id === 'score-b') { e.preventDefault(); reactions['controler-score'](); }
  else if (e.target.matches('[data-action][role="button"]')) e.target.click();
});

// ---------- Démarrage ----------
const idUrl = new URLSearchParams(window.location.search).get('t');
const initial = idUrl ? stockage.lireLocal(idUrl) : null;
if (initial) ouvrir(initial);
else rendre();
