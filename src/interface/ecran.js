// Écran du vidéoprojecteur : plein écran, lecture seule, alterne seul entre les vues.
// Adresse : ecran.html?t=<identifiant>. Options : &duree=12 (secondes par vue), &enligne=1 (forcer la base en ligne).
// Clavier : flèches gauche/droite = changer de vue, espace = pause.

import { calculer } from '../moteur/tournoi.js';
import { surveiller, enLigneConfigure } from '../donnees/stockage.js';
import { h, annuaire, htmlMatch, htmlPoule, htmlTableau, htmlEquipe, htmlQr, destinations, nomManche, adressePage, heureCourte, pluriel } from './rendu.js';

const params = new URLSearchParams(window.location.search);
const id = params.get('t');
const $ = (s) => document.querySelector(s);
const etat = { evenement: null, pages: [], index: 0, debut: Date.now(), pause: false, source: 'aucune', erreur: null, maj: null };

const decouper = (liste, taille) => {
  const paquets = [];
  for (let i = 0; i < liste.length; i += taille) paquets.push(liste.slice(i, i + taille));
  return paquets;
};

/** Vues d'un tournoi, dans l'ordre d'affichage. Chaque vue : { nom, html }. */
function pagesDuTournoi(tournoi, prefixe) {
  const vue = calculer(tournoi);
  const equipes = annuaire(tournoi);
  const joueurs = vue.parametres.afficherJoueurs;
  const pages = [];
  if (!vue.etapes.length) {
    return [{ nom: `${prefixe}En attente`, html: '<div class="vide"><div><h2>Le tirage des poules arrive</h2><p class="discret">Les poules et les matchs s\'afficheront ici.</p></div></div>' }];
  }
  const manche = vue.mancheCourante;

  // 1. Matchs de la manche en cours, par numéro de planche ou de terrain.
  if (manche) {
    const tries = manche.matchs.slice().sort((x, y) => x.vague - y.vague || (x.heure || '').localeCompare(y.heure || '') || x.lieu - y.lieu);
    const parPage = tries.length <= 36 ? 36 : 32;
    decouper(tries, parPage).forEach((paquet, i, tous) => {
      const colonnes = paquet.length > 9 ? 2 : 1;
      const lignes = Math.ceil(paquet.length / colonnes);
      const taille = Math.min(3.6, 40 / Math.max(lignes, 6));
      pages.push({
        nom: `${prefixe}${nomManche(manche)} : ${pluriel(manche.joues, 'match terminé', 'matchs terminés')} sur ${manche.matchs.length}${tous.length > 1 ? ` (${i + 1}/${tous.length})` : ''}`,
        html: `<div class="colonnes-matchs" style="grid-template-rows:repeat(${lignes},1fr);font-size:${taille}vh">${paquet.map((m) => htmlMatch(m, equipes, { joueurs: false })).join('')}</div>`,
      });
    });
  }

  // 2. Classements des poules de l'étape en cours (ou de la dernière étape de poules).
  const etapesPoules = vue.etapes.filter((e) => e.type === 'poules');
  const etape = (manche && etapesPoules.find((e) => e.id === manche.etape)) || etapesPoules[etapesPoules.length - 1];
  if (etape && etape.groupes.some((g) => g.classement.length)) {
    const destination = destinations(tournoi, vue, etape.id);
    const enCoursDepartage = etape.groupes.some((g) => g.egalites.some((e) => !e.resolue));
    decouper(etape.groupes, 8).forEach((paquet, i, tous) => {
      const colonnes = Math.min(4, paquet.length);
      const rangees = Math.ceil(paquet.length / colonnes);
      const lignesMax = Math.max(...paquet.map((g) => g.places.length)) + 2;
      const taille = Math.min(3.4, 78 / (rangees * lignesMax));
      pages.push({
        nom: `${prefixe}${etape.nom} : classements${tous.length > 1 ? ` (${i + 1}/${tous.length})` : ''}`,
        html: `${enCoursDepartage ? '<div class="bandeau-depart">Égalité en cours de départage dans une poule : le classement affiché est provisoire.</div>' : ''}
          <div class="grille-poules" style="grid-template-columns:repeat(${colonnes},1fr);grid-template-rows:repeat(${rangees},1fr);font-size:min(${taille}vh,${(5.4 / colonnes).toFixed(2)}vw)">${paquet.map((g) => htmlPoule(g, equipes, vue, { destination, joueurs, compact: true })).join('')}</div>`,
      });
    });
  }

  // 3. Tableaux finaux, dès que la phase finale est en cours ou terminée.
  const finales = vue.etapes.find((e) => e.type === 'tableaux');
  const enFinales = finales && (vue.termine || (manche && manche.etape === finales.id));
  if (enFinales) {
    for (const t of finales.tableaux) pages.push({ nom: `${prefixe}${finales.nom} : ${t.nom}`, html: htmlTableau(t, equipes, vue) });
  }

  // 4. Classement général, dès que des places sont connues.
  const connues = vue.classementFinal.filter((l) => l.equipe != null);
  if ((enFinales || vue.termine) && connues.length) {
    decouper(vue.classementFinal, 32).forEach((paquet, i, tous) => {
      const lignes = Math.ceil(paquet.length / 2);
      pages.push({
        nom: `${prefixe}Classement général${tous.length > 1 ? ` (${i + 1}/${tous.length})` : ''}`,
        html: `<div class="colonnes-final" style="grid-template-rows:repeat(${lignes},1fr);font-size:${Math.min(3.4, 40 / Math.max(lignes, 6))}vh">${paquet.map((l) => `<div class="rang-final"><span class="place">${h(l.place)}</span>${htmlEquipe(equipes, l.equipe, l.origine)}<span class="discret" style="margin-left:auto">${h(l.niveau)}</span></div>`).join('')}</div>`,
      });
    });
  }
  return pages;
}

function reconstruire() {
  const e = etat.evenement;
  if (!e) {
    etat.pages = [{ nom: '', html: `<div class="vide"><div><h2>Aucun tournoi à afficher</h2><p class="discret">${id ? `Le tournoi « ${h(id)} » est introuvable. Ouvrez cet écran depuis la rubrique Diffusion de la table de marque.` : 'Ouvrez cet écran depuis la rubrique Diffusion de la table de marque.'}</p></div></div>` }];
  } else {
    $('#titre').textContent = e.nom;
    document.title = `Écran · ${e.nom}`;
    etat.pages = e.tournois.flatMap((t) => pagesDuTournoi(t, e.tournois.length > 1 ? `${t.nom} · ` : ''));
  }
  if (etat.index >= etat.pages.length) etat.index = 0;
  afficher();
}

function afficher() {
  const page = etat.pages[etat.index] || { nom: '', html: '' };
  $('#nom-vue').textContent = page.nom;
  $('#scene').innerHTML = page.html;
}

function aller(pas) {
  if (!etat.pages.length) return;
  etat.index = (etat.index + pas + etat.pages.length) % etat.pages.length;
  etat.debut = Date.now();
  afficher();
}

function battre() {
  const duree = Number(params.get('duree')) || (etat.evenement && etat.evenement.affichage && etat.evenement.affichage.duree) || 15;
  const ecoule = (Date.now() - etat.debut) / 1000;
  if (etat.pause) etat.debut = Date.now() - Math.min(ecoule, duree) * 1000;
  else if (ecoule >= duree) aller(1);
  $('#barre').style.width = `${Math.min(100, (ecoule / duree) * 100)}%`;
  $('#heure').textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  $('#liaison').textContent = etat.pause ? 'En pause (espace pour reprendre)'
    : etat.erreur ? 'Connexion perdue, nouvelle tentative en cours'
    : etat.source === 'local' ? 'Relié à la table de marque de cet ordinateur' : etat.maj ? `En ligne, reçu à ${heureCourte(etat.maj)}` : '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') aller(1);
  else if (e.key === 'ArrowLeft') aller(-1);
  else if (e.key === ' ') { e.preventDefault(); etat.pause = !etat.pause; }
});

if (enLigneConfigure() && id) {
  $('#qr').innerHTML = htmlQr(adressePage('index.html', id));
  $('#invite').innerHTML = 'Suivez votre équipe<br>sur votre téléphone';
}

const liaison = surveiller(id || '', (evenement) => { etat.evenement = evenement; etat.maj = new Date().toISOString(); reconstruire(); }, {
  periode: 5, forcerEnLigne: params.get('enligne') === '1', surErreur: (e) => { etat.erreur = e; },
});
etat.source = liaison.source;
setInterval(battre, 250);
battre();
