// Écran du vidéoprojecteur : plein écran, lecture seule.
// Deux modes de défilement, comme une présentation Google Slides :
//   automatique : les vues tournent seules (durée réglable, boucle ou arrêt sur la dernière) ;
//   manuel      : on passe d'une vue à l'autre au clic, au clavier ou à la télécommande de présentation.
// Adresse : ecran.html?t=<identifiant>. Options : &duree=12 (secondes par vue), &mode=manuel,
// &enligne=1 (forcer la base en ligne).
// Souris : clic sur la vue = vue suivante ; barre de commandes en bas à gauche (apparaît quand on bouge la souris).
// Clavier : flèches, Page suivante/précédente = changer de vue ; espace = automatique/manuel ; F = plein écran.
// Les réglages faits sur l'écran restent sur cet ordinateur (stockage du navigateur).

import { calculer } from '../moteur/tournoi.js';
import { surveiller, enLigneConfigure } from '../donnees/stockage.js';
import { h, annuaire, htmlMatch, htmlPoule, htmlTableau, htmlEquipe, htmlQr, destinations, nomManche, adressePage, heureCourte, pluriel } from './rendu.js';

const params = new URLSearchParams(window.location.search);
const id = params.get('t');
const $ = (s) => document.querySelector(s);
const etat = { evenement: null, pages: [], index: 0, debut: Date.now(), source: 'aucune', erreur: null, maj: null, htmlAffiche: null };

// ---------- Réglages propres à cet écran ----------
const CLE_REGLAGES = 'tournois-fcssm:ecran';
const DUREES = [5, 8, 10, 15, 20, 30, 45, 60, 90, 120];
function lireReglages() {
  let r = {};
  try { r = JSON.parse(window.localStorage.getItem(CLE_REGLAGES)) || {}; } catch { r = {}; }
  return { auto: r.auto !== false, boucle: r.boucle !== false, duree: Number(r.duree) || null };
}
const reglages = lireReglages();
if (params.get('mode') === 'manuel') reglages.auto = false;
if (params.get('mode') === 'auto') reglages.auto = true;
function garderReglages() {
  try { window.localStorage.setItem(CLE_REGLAGES, JSON.stringify(reglages)); } catch { /* navigateur sans stockage : réglages perdus au rechargement */ }
}
/** Durée de la table de marque (ou de l'adresse), utilisée quand l'écran n'a pas son propre réglage. */
const dureeTable = () => Number(params.get('duree')) || (etat.evenement && etat.evenement.affichage && etat.evenement.affichage.duree) || 15;
const duree = () => reglages.duree || dureeTable();

const decouper = (liste, taille) => {
  const paquets = [];
  for (let i = 0; i < liste.length; i += taille) paquets.push(liste.slice(i, i + taille));
  return paquets;
};

/** Vues d'un tournoi, dans l'ordre d'affichage. Chaque vue : { cle, nom, html }.
 *  La clé reste stable quand les scores changent : elle permet de rester sur la même vue en mode manuel. */
function pagesDuTournoi(tournoi, prefixe) {
  const cle = (suite) => `${tournoi.cle || prefixe}|${suite}`;
  const vue = calculer(tournoi);
  const equipes = annuaire(tournoi);
  const joueurs = vue.parametres.afficherJoueurs;
  const pages = [];
  if (!vue.etapes.length) {
    return [{ cle: cle('attente'), nom: `${prefixe}En attente`, html: '<div class="vide"><div><h2>Le tirage des poules arrive</h2><p class="discret">Les poules et les matchs s\'afficheront ici.</p></div></div>' }];
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
        cle: cle(`matchs-${i}`),
        nom: `${prefixe}${nomManche(manche)} : ${pluriel(manche.joues, 'match terminé', 'matchs terminés')} sur ${manche.matchs.length}${tous.length > 1 ? ` (${i + 1}/${tous.length})` : ''}`,
        html: `<div class="colonnes-matchs" style="grid-template-rows:repeat(${lignes},1fr);font-size:min(${taille}vh,${colonnes === 2 ? 1.55 : 2.6}vw)">${paquet.map((m) => htmlMatch(m, equipes, { joueurs: false })).join('')}</div>`,
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
        cle: cle(`poules-${etape.id}-${i}`),
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
    for (const t of finales.tableaux) pages.push({ cle: cle(`tableau-${t.nom}`), nom: `${prefixe}${finales.nom} : ${t.nom}`, html: htmlTableau(t, equipes, vue) });
  }

  // 4. Classement général, dès que des places sont connues.
  const connues = vue.classementFinal.filter((l) => l.equipe != null);
  if ((enFinales || vue.termine) && connues.length) {
    decouper(vue.classementFinal, 32).forEach((paquet, i, tous) => {
      const lignes = Math.ceil(paquet.length / 2);
      pages.push({
        cle: cle(`general-${i}`),
        nom: `${prefixe}Classement général${tous.length > 1 ? ` (${i + 1}/${tous.length})` : ''}`,
        html: `<div class="colonnes-final" style="grid-template-rows:repeat(${lignes},1fr);font-size:${Math.min(3.4, 40 / Math.max(lignes, 6))}vh">${paquet.map((l) => `<div class="rang-final"><span class="place">${h(l.place)}</span>${htmlEquipe(equipes, l.equipe, l.origine)}<span class="discret" style="margin-left:auto">${h(l.niveau)}</span></div>`).join('')}</div>`,
      });
    });
  }
  return pages;
}

function reconstruire() {
  const e = etat.evenement;
  const avant = etat.pages[etat.index];
  if (!e) {
    etat.pages = [{ cle: 'aucun', nom: '', html: `<div class="vide"><div><h2>Aucun tournoi à afficher</h2><p class="discret">${id ? `Le tournoi « ${h(id)} » est introuvable. Ouvrez cet écran depuis la rubrique Diffusion de la table de marque.` : 'Ouvrez cet écran depuis la rubrique Diffusion de la table de marque.'}</p></div></div>` }];
  } else {
    $('#titre').textContent = e.nom;
    document.title = `Écran · ${e.nom}`;
    etat.pages = e.tournois.flatMap((t) => pagesDuTournoi(t, e.tournois.length > 1 ? `${t.nom} · ` : ''));
  }
  // Rester sur la même vue après une mise à jour des scores, sinon sur la plus proche.
  const retrouvee = avant ? etat.pages.findIndex((p) => p.cle === avant.cle) : -1;
  etat.index = retrouvee >= 0 ? retrouvee : Math.min(etat.index, etat.pages.length - 1);
  afficher();
}

function afficher() {
  const page = etat.pages[etat.index] || { nom: '', html: '' };
  $('#nom-vue').textContent = page.nom;
  // Ne réécrire la vue que si elle a changé : pas de clignotement à chaque mise à jour.
  if (page.html !== etat.htmlAffiche) { $('#scene').innerHTML = page.html; etat.htmlAffiche = page.html; }
  $('#compteur').textContent = etat.pages.length > 1 ? `${etat.index + 1} / ${etat.pages.length}` : '';
}

/** Change de vue. En mode boucle, on repart au début après la dernière ; sinon on s'arrête aux extrémités. */
function aller(pas) {
  const n = etat.pages.length;
  if (!n) return;
  const cible = etat.index + pas;
  etat.index = reglages.boucle ? (cible + n) % n : Math.max(0, Math.min(n - 1, cible));
  etat.debut = Date.now();
  afficher();
}
function allerA(index) {
  etat.index = Math.max(0, Math.min(etat.pages.length - 1, index));
  etat.debut = Date.now();
  afficher();
}

function battre() {
  const d = duree();
  const ecoule = (Date.now() - etat.debut) / 1000;
  const derniere = etat.index >= etat.pages.length - 1;
  const bloque = !reglages.boucle && derniere;
  if (reglages.auto && !bloque && ecoule >= d) aller(1);
  const barre = $('#barre');
  barre.parentElement.hidden = !reglages.auto || etat.pages.length < 2;
  barre.style.width = bloque ? '100%' : `${Math.min(100, (ecoule / d) * 100)}%`;
  $('#heure').textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  $('#liaison').textContent = etat.erreur ? 'Connexion perdue, nouvelle tentative en cours'
    : etat.source === 'local' ? 'Relié à la table de marque de cet ordinateur' : etat.maj ? `En ligne, reçu à ${heureCourte(etat.maj)}` : '';
  $('#mode').textContent = !reglages.auto ? 'Défilement manuel' : bloque ? 'Fin du défilement' : '';
}

// ---------- Barre de commandes (en bas à gauche, comme Google Slides) ----------
const ICONES = {
  prec: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>',
  suiv: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>',
  lecture: '<svg viewBox="0 0 24 24"><path class="plein" d="M7 4.5v15l12-7.5z" /></svg>',
  pause: '<svg viewBox="0 0 24 24"><path class="plein" d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" /></svg>',
  reglages: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>',
  plein: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>',
};

function construireCommandes() {
  const zone = $('#commandes');
  zone.innerHTML = `
    <div class="barre-commandes">
      <button data-cmd="prec" title="Vue précédente (flèche gauche)" aria-label="Vue précédente">${ICONES.prec}</button>
      <button data-cmd="lecture" id="btn-lecture"></button>
      <button data-cmd="suiv" title="Vue suivante (flèche droite ou clic)" aria-label="Vue suivante">${ICONES.suiv}</button>
      <span class="compteur" id="compteur"></span>
      <button data-cmd="reglages" id="btn-reglages" title="Options de défilement" aria-label="Options de défilement" aria-expanded="false">${ICONES.reglages}</button>
      <button data-cmd="plein" title="Plein écran (F)" aria-label="Plein écran">${ICONES.plein}</button>
    </div>
    <div class="panneau-reglages" id="panneau-reglages" hidden>
      <div class="titre-panneau">Défilement</div>
      <label class="choix"><input type="radio" name="mode-defil" value="auto"> Automatique</label>
      <label class="choix"><input type="radio" name="mode-defil" value="manuel"> Manuel (clic ou flèches)</label>
      <div class="titre-panneau">Durée de chaque vue</div>
      <select id="choix-duree" aria-label="Durée de chaque vue"></select>
      <label class="choix"><input type="checkbox" id="choix-boucle"> Recommencer après la dernière vue</label>
      <div class="titre-panneau">Aller à la vue</div>
      <ol class="liste-vues" id="liste-vues"></ol>
    </div>`;

  zone.addEventListener('click', (ev) => {
    ev.stopPropagation(); // un clic dans la barre ne doit pas faire avancer la vue
    const b = ev.target.closest('[data-cmd], [data-vue]');
    if (!b) return;
    if (b.dataset.vue != null) { allerA(Number(b.dataset.vue)); majCommandes(); return; }
    const cmd = b.dataset.cmd;
    if (cmd === 'prec') aller(-1);
    else if (cmd === 'suiv') aller(1);
    else if (cmd === 'lecture') basculerAuto();
    else if (cmd === 'reglages') ouvrirReglages($('#panneau-reglages').hidden);
    else if (cmd === 'plein') pleinEcran();
    majCommandes();
  });
  zone.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.name === 'mode-defil') { reglages.auto = el.value === 'auto'; etat.debut = Date.now(); }
    else if (el.id === 'choix-duree') reglages.duree = Number(el.value) || null;
    else if (el.id === 'choix-boucle') reglages.boucle = el.checked;
    garderReglages();
    majCommandes();
  });
}

function majCommandes() {
  const btn = $('#btn-lecture');
  btn.innerHTML = reglages.auto ? ICONES.pause : ICONES.lecture;
  btn.title = reglages.auto ? 'Passer en manuel (espace)' : 'Lancer le défilement automatique (espace)';
  btn.setAttribute('aria-label', btn.title);
  for (const r of document.querySelectorAll('input[name="mode-defil"]')) r.checked = (r.value === 'auto') === reglages.auto;
  const t = dureeTable();
  const valeurs = [...new Set([...DUREES, reglages.duree].filter(Boolean))].sort((a, b) => a - b);
  $('#choix-duree').innerHTML = `<option value="">Comme la table de marque (${t} s)</option>${valeurs.map((v) => `<option value="${v}">${v} secondes</option>`).join('')}`;
  $('#choix-duree').value = reglages.duree ? String(reglages.duree) : '';
  $('#choix-boucle').checked = reglages.boucle;
  $('#liste-vues').innerHTML = etat.pages.map((p, i) => `<li><button data-vue="${i}" class="${i === etat.index ? 'actuelle' : ''}">${h(p.nom || 'Vue')}</button></li>`).join('');
}

function ouvrirReglages(ouvrir) {
  $('#panneau-reglages').hidden = !ouvrir;
  $('#btn-reglages').setAttribute('aria-expanded', String(ouvrir));
  if (ouvrir) majCommandes();
}
function basculerAuto() {
  reglages.auto = !reglages.auto;
  etat.debut = Date.now();
  garderReglages();
}
function pleinEcran() {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
}

// La barre et le curseur disparaissent après 3 secondes sans bouger la souris, pour ne pas gêner la projection.
let minuterieCalme = null;
function reveiller() {
  document.body.classList.remove('calme');
  clearTimeout(minuterieCalme);
  minuterieCalme = setTimeout(() => {
    if (!$('#panneau-reglages').hidden || $('#commandes').matches(':hover')) return reveiller();
    document.body.classList.add('calme');
  }, 3000);
}
document.addEventListener('mousemove', reveiller);
document.addEventListener('touchstart', reveiller, { passive: true });

// Clic sur la vue : vue suivante (comme dans une présentation). Ferme d'abord le panneau d'options s'il est ouvert.
$('#scene').addEventListener('click', () => {
  if (!$('#panneau-reglages').hidden) { ouvrirReglages(false); return; }
  aller(1);
});
$('#scene').addEventListener('contextmenu', (ev) => { ev.preventDefault(); aller(-1); });

document.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'Escape') { ouvrirReglages(false); return; }
  if (e.target.closest && e.target.closest('select, input')) return;
  if (['ArrowRight', 'ArrowDown', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); aller(1); }
  else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); aller(-1); }
  else if (k === 'Home') allerA(0);
  else if (k === 'End') allerA(etat.pages.length - 1);
  else if (k === ' ') { e.preventDefault(); basculerAuto(); }
  else if (k === 'f' || k === 'F') pleinEcran();
  else return;
  majCommandes();
});

if (enLigneConfigure() && id) {
  $('#qr').innerHTML = htmlQr(adressePage('index.html', id));
  $('#invite').innerHTML = 'Suivez votre équipe<br>sur votre téléphone';
}

construireCommandes();
const liaison = surveiller(id || '', (evenement) => {
  etat.evenement = evenement; etat.maj = new Date().toISOString(); reconstruire();
  if (!$('#panneau-reglages').hidden) majCommandes();
}, {
  periode: 5, forcerEnLigne: params.get('enligne') === '1', surErreur: (e) => { etat.erreur = e; },
});
etat.source = liaison.source;
majCommandes();
reveiller();
setInterval(battre, 250);
battre();
