// Page publique (QR code) : lecture seule, pensée pour le téléphone.
// Adresse : index.html?t=<identifiant>. Recherche d'équipe, prochain match, poule, tableaux, classement.

import { calculer } from '../moteur/tournoi.js';
import { nomEquipe } from '../moteur/actions.js';
import { surveiller, lireReglage, ecrireReglage, listerLocal, enLigneConfigure } from '../donnees/stockage.js';
import { h, annuaire, htmlMatch, htmlPoule, htmlTableau, htmlClassementFinal, htmlPlaque, htmlEquipe, destinations, nomManche, heureCourte, pluriel } from './rendu.js';

const params = new URLSearchParams(window.location.search);
const id = params.get('t');
const $ = (s) => document.querySelector(s);
const etat = {
  evenement: null, cle: null, onglet: 'equipe', recherche: '', etapePoules: null,
  suivie: id ? lireReglage(`suivie:${id}`, null) : null, // { cle, equipe }
  source: 'aucune', erreur: null, maj: null,
};

const tournoiCourant = () => etat.evenement.tournois.find((t) => t.cle === etat.cle) || etat.evenement.tournois[0];

function htmlRecherche(tournoi) {
  const q = etat.recherche.trim().toLowerCase();
  const trouvees = q === '' ? [] : tournoi.equipes.filter((e) =>
    String(e.id) === q || nomEquipe(e).toLowerCase().includes(q) || (e.joueurs || []).some((j) => j.toLowerCase().includes(q))).slice(0, 10);
  return `<div class="recherche">
      <label for="recherche">Trouver mon équipe</label>
      <input type="search" id="recherche" placeholder="Nom ou numéro d'équipe" value="${h(etat.recherche)}" autocomplete="off">
    </div>
    <ul class="resultats" id="resultats" ${trouvees.length ? '' : 'hidden'}>${trouvees.map((e) => `<li><button data-action="suivre" data-id="${e.id}">${htmlEquipe(annuaire(tournoi), e.id)}</button></li>`).join('')}</ul>
    ${q !== '' && !trouvees.length ? '<p class="discret">Aucune équipe trouvée. Essayez le numéro d\'équipe.</p>' : ''}`;
}

function htmlMonEquipe(tournoi, vue, equipes) {
  const suivie = etat.suivie && etat.suivie.cle === tournoi.cle && equipes.has(etat.suivie.equipe) ? etat.suivie.equipe : null;
  if (suivie == null) {
    return `${htmlRecherche(tournoi)}<p class="discret" style="margin-top:14px">Choisissez votre équipe pour voir votre prochain match, votre ${h(vue.format.nomLieu.toLowerCase())} et votre classement. Rien à installer, aucun compte.</p>`;
  }
  const joueurs = vue.parametres.afficherJoueurs;
  const mesMatchs = vue.manches.flatMap((manche) => manche.matchs.filter((m) => m.a === suivie || m.b === suivie).map((m) => ({ m, manche })));
  const prochain = mesMatchs.find(({ m }) => !m.joue);
  const joues = mesMatchs.filter(({ m }) => m.joue);
  let bloc;
  if (prochain) {
    const { m, manche } = prochain;
    const adversaire = m.a === suivie ? htmlEquipe(equipes, m.b, m.origineB, { joueurs }) : htmlEquipe(equipes, m.a, m.origineA, { joueurs });
    bloc = `<p class="discret petit">Prochain match : ${h(nomManche(manche))}, ${h(m.libelle)}</p>
      <div class="prochain">${htmlPlaque(m)}<div class="contre">${h(m.nomLieu)} ${m.lieu ?? '?'}${m.heure ? ` à ${h(m.heure)}` : ''}<br>contre ${adversaire}</div></div>`;
  } else {
    const place = vue.classementFinal.find((l) => l.equipe === suivie);
    const attente = vue.termine ? '' : '<p class="discret">Votre prochain match s\'affichera dès que votre adversaire sera connu.</p>';
    bloc = place ? `<p><strong>Place finale : ${h(place.place)}</strong>${place.niveau ? ` (${h(place.niveau)})` : ''}</p>` : attente;
  }
  // Poule la plus récente de l'équipe.
  let poule = '';
  for (const etape of vue.etapes.filter((e) => e.type === 'poules').reverse()) {
    const g = etape.groupes.find((x) => x.places.some((p) => p.equipe === suivie));
    if (g) { poule = `<h2>${h(etape.nom)}</h2>${htmlPoule(g, equipes, vue, { destination: destinations(tournoi, vue, etape.id), complet: true, suivie, joueurs })}`; break; }
  }
  return `<div class="carte-equipe">
      <div class="ligne" style="justify-content:space-between"><h2 style="margin:0">${htmlEquipe(equipes, suivie, '', { joueurs })}</h2><button class="lien" data-action="changer-equipe">Changer d'équipe</button></div>
      ${bloc}
    </div>
    ${poule}
    ${joues.length ? `<h2>Mes résultats</h2><div class="liste-matchs">${joues.map(({ m, manche }) => htmlMatch(m, equipes, { info: `${h(nomManche(manche))}, ${h(m.libelle)}` })).join('')}</div>` : ''}`;
}

function htmlMatchs(vue, equipes) {
  const manche = vue.mancheCourante || vue.manches[vue.manches.length - 1];
  if (!manche) return '<p class="discret">Les matchs s\'afficheront après le tirage des poules.</p>';
  const tries = manche.matchs.slice().sort((x, y) => x.vague - y.vague || (x.heure || '').localeCompare(y.heure || '') || x.lieu - y.lieu);
  return `<h2>${h(nomManche(manche))}</h2><p class="discret petit">${pluriel(manche.joues, 'match terminé', 'matchs terminés')} sur ${manche.matchs.length}.</p>
    <div class="liste-matchs">${tries.map((m) => htmlMatch(m, equipes, { info: h(m.libelle) })).join('')}</div>`;
}

function htmlPoules(tournoi, vue, equipes) {
  const etapes = vue.etapes.filter((e) => e.type === 'poules');
  if (!etapes.length) return '<p class="discret">Les poules s\'afficheront après le tirage.</p>';
  const courante = vue.mancheCourante && etapes.find((e) => e.id === vue.mancheCourante.etape);
  const etape = etapes.find((e) => e.id === etat.etapePoules) || courante || etapes[etapes.length - 1];
  const suivie = etat.suivie && etat.suivie.cle === tournoi.cle ? etat.suivie.equipe : null;
  const choix = etapes.length > 1 ? `<div class="onglets-etapes">${etapes.map((e) => `<button data-action="etape-poules" data-id="${e.id}" aria-pressed="${e === etape}">${h(e.nom)}</button>`).join('')}</div>` : '';
  return `${choix}<div class="poules">${etape.groupes.map((g) => htmlPoule(g, equipes, vue, { destination: destinations(tournoi, vue, etape.id), suivie, joueurs: vue.parametres.afficherJoueurs })).join('')}</div>`;
}

function rendre() {
  const e = etat.evenement;
  if (!e) {
    const locaux = listerLocal();
    $('#onglets').innerHTML = '';
    $('#contenu').innerHTML = `<h2>${id ? 'Tournoi introuvable' : 'Bienvenue'}</h2>
      <p>${id ? 'Ce tournoi n\'est pas encore publié, ou l\'adresse est incomplète.' : 'Scannez le QR code affiché dans la salle pour suivre le tournoi en cours.'}</p>
      ${locaux.length ? `<h2>Tournois sur cet appareil</h2><ul>${locaux.map((x) => `<li><a href="?t=${encodeURIComponent(x.id)}">${h(x.nom)}</a></li>`).join('')}</ul>` : ''}
      ${etat.erreur ? '<p class="discret">Connexion impossible pour le moment. La page réessaie toute seule.</p>' : ''}`;
    return;
  }
  const tournoi = tournoiCourant();
  const vue = calculer(tournoi);
  const equipes = annuaire(tournoi);
  $('#titre').textContent = e.nom;
  document.title = e.nom;
  $('#sous-titre').textContent = vue.termine ? 'Tournoi terminé' : vue.mancheCourante ? `En cours : ${nomManche(vue.mancheCourante)}` : 'FC Sud Sèvre et Maine';
  const aTableaux = vue.etapes.some((x) => x.type === 'tableaux');
  const onglets = [['equipe', 'Mon équipe'], ['matchs', 'Matchs'], ['poules', 'Poules'], ...(aTableaux ? [['tableaux', 'Tableaux']] : []), ['final', 'Classement']];
  $('#onglets').innerHTML = onglets.map(([o, nom]) => `<button data-action="onglet" data-id="${o}"${etat.onglet === o ? ' aria-current="page"' : ''}>${nom}</button>`).join('');
  const choixTournoi = e.tournois.length > 1
    ? `<div class="onglets-etapes">${e.tournois.map((t) => `<button data-action="tournoi" data-id="${h(t.cle)}" aria-pressed="${t.cle === tournoi.cle}">${h(t.nom)}</button>`).join('')}</div>` : '';
  let corps;
  if (etat.onglet === 'matchs') corps = htmlMatchs(vue, equipes);
  else if (etat.onglet === 'poules') corps = htmlPoules(tournoi, vue, equipes);
  else if (etat.onglet === 'tableaux') corps = vue.etapes.filter((x) => x.type === 'tableaux').flatMap((x) => x.tableaux).map((t) => htmlTableau(t, equipes, vue)).join('');
  else if (etat.onglet === 'final') corps = htmlClassementFinal(vue, equipes);
  else corps = htmlMonEquipe(tournoi, vue, equipes);
  const liaison = etat.erreur ? 'Connexion perdue, la page réessaie toute seule.' : etat.maj ? `Mis à jour à ${heureCourte(etat.maj)}. La page se rafraîchit seule.` : '';
  $('#contenu').innerHTML = `${choixTournoi}${corps}<p class="etat-liaison">${liaison}</p>`;
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'onglet') etat.onglet = el.dataset.id;
  else if (action === 'tournoi') etat.cle = el.dataset.id;
  else if (action === 'etape-poules') etat.etapePoules = el.dataset.id;
  else if (action === 'suivre') {
    etat.suivie = { cle: tournoiCourant().cle, equipe: Number(el.dataset.id) };
    etat.recherche = '';
    ecrireReglage(`suivie:${id}`, etat.suivie);
  } else if (action === 'changer-equipe') { etat.suivie = null; ecrireReglage(`suivie:${id}`, null); }
  rendre();
  window.scrollTo(0, 0);
});

// La recherche se met à jour à chaque lettre, sans perdre le curseur.
document.addEventListener('input', (ev) => {
  if (ev.target.id !== 'recherche') return;
  etat.recherche = ev.target.value;
  const position = ev.target.selectionStart;
  rendre();
  const champ = $('#recherche');
  if (champ) { champ.focus(); champ.setSelectionRange(position, position); }
});

const liaison = surveiller(id || '', (evenement) => {
  const actif = document.activeElement && document.activeElement.id === 'recherche';
  etat.evenement = evenement;
  etat.maj = new Date().toISOString();
  if (evenement && etat.suivie && !etat.cle) etat.cle = etat.suivie.cle;
  if (!actif) rendre(); // on ne redessine pas pendant que la personne tape sa recherche
}, { periode: 10, forcerEnLigne: params.get('enligne') === '1', surErreur: (e) => { etat.erreur = e; } });
etat.source = liaison.source;
if (!etat.evenement) rendre();
