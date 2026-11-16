// Couche d'accès aux données : UNIQUE et REMPLAÇABLE.
// Tout le reste du code ne connaît que les fonctions exportées ici.
// Pour changer de service gratuit, il suffit de réécrire la partie « en ligne » de ce fichier
// (voir documentation/hebergement.md).
//
// Deux endroits :
// - local  : le navigateur de la table de marque (localStorage). Fonctionne sans internet.
// - enligne : Firebase Realtime Database, lu et écrit par simples requêtes web (aucune bibliothèque).

import { CONFIG } from './config.js';

const PREFIXE = 'fcssm:';
const cleEvenement = (id) => `${PREFIXE}evenement:${id}`;
const cleSauvegardes = (id) => `${PREFIXE}sauvegardes:${id}`;
const NB_SAUVEGARDES = 40;

const lireJson = (cle, defaut) => {
  try { const brut = localStorage.getItem(cle); return brut ? JSON.parse(brut) : defaut; } catch { return defaut; }
};
const ecrireJson = (cle, valeur) => {
  try { localStorage.setItem(cle, JSON.stringify(valeur)); return true; } catch { return false; }
};

// ---------- Local ----------

export function lireLocal(id) {
  return lireJson(cleEvenement(id), null);
}

/** Enregistre l'événement dans le navigateur et garde une sauvegarde datée (restauration en un clic). */
export function ecrireLocal(evenement, libelle = '') {
  ecrireJson(cleEvenement(evenement.id), evenement);
  const liste = lireJson(`${PREFIXE}liste`, []).filter((e) => e.id !== evenement.id);
  liste.unshift({ id: evenement.id, nom: evenement.nom, maj: evenement.maj });
  ecrireJson(`${PREFIXE}liste`, liste);
  if (libelle) {
    const sauvegardes = lireJson(cleSauvegardes(evenement.id), []);
    sauvegardes.unshift({ date: evenement.maj, libelle, rev: evenement.rev, etat: evenement });
    // Si le navigateur manque de place, on garde moins de sauvegardes plutôt que d'échouer.
    let n = NB_SAUVEGARDES;
    while (n > 0 && !ecrireJson(cleSauvegardes(evenement.id), sauvegardes.slice(0, n))) n = Math.floor(n / 2);
  }
}

export function listerLocal() {
  return lireJson(`${PREFIXE}liste`, []);
}

export function supprimerLocal(id) {
  localStorage.removeItem(cleEvenement(id));
  localStorage.removeItem(cleSauvegardes(id));
  ecrireJson(`${PREFIXE}liste`, lireJson(`${PREFIXE}liste`, []).filter((e) => e.id !== id));
}

export function listerSauvegardes(id) {
  return lireJson(cleSauvegardes(id), []);
}

/** Réglages propres à cet ordinateur (code de la table, nom de l'opérateur, équipe suivie...). */
export function lireReglage(nom, defaut = '') {
  return lireJson(`${PREFIXE}reglage:${nom}`, defaut);
}
export function ecrireReglage(nom, valeur) {
  ecrireJson(`${PREFIXE}reglage:${nom}`, valeur);
}

/** Appelle `rappel` quand l'événement change dans un autre onglet du même navigateur. */
export function surveillerLocal(id, rappel) {
  const ecoute = (e) => { if (e.key === cleEvenement(id)) rappel(lireLocal(id)); };
  window.addEventListener('storage', ecoute);
  return () => window.removeEventListener('storage', ecoute);
}

// ---------- En ligne (Firebase Realtime Database, par requêtes web) ----------

export function urlBase() {
  return (CONFIG.urlBase || '').replace(/\/+$/, '');
}
export function enLigneConfigure() {
  return urlBase() !== '';
}

async function requete(chemin, options) {
  const reponse = await fetch(`${urlBase()}/${chemin}.json`, options);
  if (!reponse.ok) {
    const erreur = new Error(reponse.status === 401 || reponse.status === 403 ? 'Code de la table refusé par le serveur.' : `Erreur du serveur (${reponse.status}).`);
    erreur.code = reponse.status;
    throw erreur;
  }
  return reponse.json();
}

/** Numéro de version publié (requête minuscule, pour savoir s'il faut recharger). */
export async function lireRevEnLigne(id) {
  return requete(`pub/${id}/rev`, { cache: 'no-store' });
}

export async function lireEnLigne(id) {
  const brut = await requete(`pub/${id}/etat`, { cache: 'no-store' });
  return brut ? JSON.parse(brut) : null;
}

/**
 * Publie l'événement. Le serveur n'accepte l'écriture que si le code de la table est le bon
 * (règles de sécurité : documentation/hebergement.md).
 */
export async function ecrireEnLigne(evenement, code) {
  const rev = Date.now(); // toujours croissant, même après une restauration
  const corps = {
    [`pub/${evenement.id}`]: { rev, nom: evenement.nom, etat: JSON.stringify(evenement) },
    [`preuves/${evenement.id}`]: { rev, cle: code },
  };
  await requete('', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
  return rev;
}

/**
 * Surveille l'événement en ligne : interroge le numéro de version toutes les `periode` secondes
 * et ne télécharge l'état complet que s'il a changé (économie de données sur les téléphones).
 */
export function surveillerEnLigne(id, rappel, { periode = 8, surErreur = () => {} } = {}) {
  let rev = null;
  let actif = true;
  let minuterie = null;
  const tour = async () => {
    if (!actif) return;
    try {
      if (!document.hidden) {
        const nouvelle = await lireRevEnLigne(id);
        if (nouvelle !== rev) {
          const evenement = await lireEnLigne(id);
          rev = nouvelle;
          rappel(evenement);
        }
        surErreur(null);
      }
    } catch (e) { surErreur(e); }
    if (actif) minuterie = setTimeout(tour, periode * 1000);
  };
  tour();
  const reveil = () => { if (!document.hidden) { clearTimeout(minuterie); tour(); } };
  document.addEventListener('visibilitychange', reveil);
  return () => { actif = false; clearTimeout(minuterie); document.removeEventListener('visibilitychange', reveil); };
}

// ---------- Choix de la source pour les pages en lecture (écran et page publique) ----------

/**
 * Surveille un événement depuis la meilleure source disponible :
 * la copie locale si elle existe (même ordinateur que la table, instantané et sans internet),
 * sinon la base en ligne.
 * @returns {{ source: 'local' | 'enligne' | 'aucune', arreter: function }}
 */
export function surveiller(id, rappel, options = {}) {
  const local = lireLocal(id);
  if (local && !options.forcerEnLigne) {
    rappel(local);
    return { source: 'local', arreter: surveillerLocal(id, rappel) };
  }
  if (enLigneConfigure()) return { source: 'enligne', arreter: surveillerEnLigne(id, rappel, options) };
  rappel(null);
  return { source: 'aucune', arreter: () => {} };
}
