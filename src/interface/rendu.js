// Fabrication du HTML commun aux trois pages (table de marque, écran, page publique).
// Aucune règle sportive ici : ce fichier met en forme la « vue » calculée par le moteur.

import { nomEquipe } from '../moteur/actions.js';
import { etapesDe } from '../moteur/tournoi.js';
import qrcode from '../vendor/qrcode.mjs';

/** Échappe un texte pour l'insérer dans du HTML. */
export function h(texte) {
  return String(texte ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Annuaire des équipes d'un tournoi : identifiant -> équipe. */
export function annuaire(tournoi) {
  return new Map((tournoi.equipes || []).map((e) => [e.id, e]));
}

/** Nom d'une équipe, ou d'où elle viendra si elle n'est pas encore connue (« 1er A », « Vainqueur Quart 2 »). */
export function htmlEquipe(equipes, id, origine = '', { joueurs = false } = {}) {
  if (id == null) return `<span class="eq attente">${h(origine || 'À venir')}</span>`;
  const e = equipes.get(id);
  const liste = joueurs && e && e.joueurs && e.joueurs.length ? `<span class="joueurs">${h(e.joueurs.join(', '))}</span>` : '';
  return `<span class="eq"><span class="num">${id}</span>${h(nomEquipe(e) || `Équipe ${id}`)}${liste}</span>`;
}

export function texteEquipe(equipes, id, origine = '') {
  if (id == null) return origine || 'À venir';
  return `${id} ${nomEquipe(equipes.get(id)) || ''}`.trim();
}

/** Numéro de planche ou de terrain, avec l'heure si le match en a une (quinte). */
export function htmlPlaque(m) {
  if (m.lieu == null) return '<span class="plaque vide">?</span>';
  return `<span class="plaque" title="${h(m.nomLieu || 'Planche')} ${m.lieu}">${m.heure ? `<small>${h(m.heure)}</small>` : ''}${m.lieu}</span>`;
}

/** Une ligne de match : plaque, équipe 1, score, équipe 2. */
export function htmlMatch(m, equipes, { info = '', balise = 'div', attributs = '', joueurs = false } = {}) {
  const score = m.joue
    ? `<span class="score"><b class="sa">${m.score.a}</b><i> à </i><b class="sb">${m.score.b}</b></span>`
    : `<span class="score attendu"><i>${m.attenteDepartage ? 'départage' : 'contre'}</i></span>`;
  const ga = m.vainqueur === 'a' ? ' gagne' : '';
  const gb = m.vainqueur === 'b' ? ' gagne' : '';
  return `<${balise} class="match${m.joue ? ' joue' : ''}" ${attributs}>
    ${htmlPlaque(m)}
    <span class="a${ga}">${htmlEquipe(equipes, m.a, m.origineA, { joueurs })}</span>
    ${score}
    <span class="b${gb}">${htmlEquipe(equipes, m.b, m.origineB, { joueurs })}</span>
    ${info ? `<span class="info">${info}</span>` : ''}
  </${balise}>`;
}

/** Position d'un niveau dans le format (0 = Principale, 1 = niveau suivant...) : donne sa couleur. */
export function indiceNiveau(vue, niveau) {
  const ordre = [];
  for (const etape of vue.etapes) {
    const liste = etape.type === 'poules' ? etape.groupes.map((g) => g.niveau) : etape.tableaux.map((t) => t.niveau);
    for (const n of liste) if (!ordre.includes(n)) ordre.push(n);
  }
  const i = ordre.filter((n) => n !== 'N').indexOf(niveau);
  return i;
}

/** Dit où mène chaque rang d'une poule : vers quel niveau à l'étape suivante, ou qualifié pour le tableau. */
export function destinations(tournoi, vue, idEtape) {
  const defs = etapesDe(tournoi);
  const suivante = defs.find((d) => d.source === idEtape);
  if (!suivante) return () => '';
  if (suivante.type === 'tableaux') return (rang) => (rang <= vue.parametres.qualifiesParPoule ? 'qualifie' : '');
  const niveaux = suivante.niveaux || [];
  return (rang) => {
    let i = niveaux.findIndex((n) => n.rangs.includes(rang));
    if (i < 0) i = niveaux.length - 1;
    return i >= 0 ? `vers-${Math.min(i, 3)}` : '';
  };
}

/** Classement d'une poule. `complet` ajoute les colonnes J, V, N, D. */
export function htmlPoule(g, equipes, vue, { destination = () => '', complet = false, compact = false, suivie = null, joueurs = false } = {}) {
  const niv = indiceNiveau(vue, g.niveau);
  const entete = `<header><h3>Poule ${h(g.nom)}</h3><span>${h(g.nomNiveau || '')}${g.terminee ? ' · terminée' : ''}</span></header>`;
  let corps;
  if (!g.classement.length) {
    corps = `<ul class="liste-equipes">${g.places.map((p) => `<li>${htmlEquipe(equipes, p.equipe, p.origine, { joueurs })}</li>`).join('')}</ul>`;
  } else {
    const lignes = g.classement.map((l) => {
      const depart = l.egalite === 'en-cours' ? ' <span class="depart">égalité en cours de départage</span>' : '';
      return `<tr class="${destination(l.rang)}${l.equipe === suivie ? ' suivie' : ''}">
        <td class="rang">${l.rang}</td>
        <td class="g">${htmlEquipe(equipes, l.equipe, '', { joueurs })}${depart}</td>
        ${compact ? '' : `<td>${l.j}</td>`}${complet ? `<td>${l.v}</td><td>${l.n}</td><td>${l.d}</td>` : ''}
        <td class="pts">${l.pts}</td>
        <td>${l.diff > 0 ? '+' : ''}${l.diff}</td>
      </tr>`;
    }).join('');
    corps = `<table class="classement"><thead><tr><th></th><th class="g">Équipe</th>${compact ? '' : '<th>J</th>'}${complet ? '<th>V</th><th>N</th><th>D</th>' : ''}<th>Pts</th><th>Diff</th></tr></thead><tbody>${lignes}</tbody></table>`;
  }
  return `<article class="poule${niv >= 0 ? ` niv-${Math.min(niv, 3)}` : ''}">${entete}${corps}</article>`;
}

/** Un duel du tableau final (deux lignes superposées). */
function htmlDuel(m, equipes) {
  const cote = (id, origine, score, gagne) =>
    `<div class="cote${gagne ? ' gagne' : ''}">${htmlEquipe(equipes, id, origine)}<b>${score ?? ''}</b></div>`;
  return `<div class="duel${m.libelle === 'Finale' ? ' final' : ''}">
    <div class="titre"><span>${h(m.libelle)}</span>${htmlPlaque(m)}</div>
    ${cote(m.a, m.origineA, m.score ? m.score.a : null, m.vainqueur === 'a')}
    ${cote(m.b, m.origineB, m.score ? m.score.b : null, m.vainqueur === 'b')}
  </div>`;
}

/** Tableau final d'un niveau : une colonne par tour, puis les matchs de classement. */
export function htmlTableau(t, equipes, vue) {
  const niv = indiceNiveau(vue, t.niveau);
  const principaux = t.matchs.filter((m) => m.principal);
  const autres = t.matchs.filter((m) => !m.principal);
  const tours = [...new Set(principaux.map((m) => m.tour))].sort((a, b) => a - b);
  const colonnes = tours.map((tour) => `<div class="colonne">${principaux.filter((m) => m.tour === tour).map((m) => htmlDuel(m, equipes)).join('')}</div>`).join('');
  const classement = autres.length ? `<div class="classement-matchs">${autres.map((m) => htmlDuel(m, equipes)).join('')}</div>` : '';
  return `<article class="tableau${niv >= 0 ? ` niv-${Math.min(niv, 3)}` : ''}"><header><h3>${h(t.nom || 'Tableau final')}</h3></header><div class="colonnes">${colonnes}</div>${classement}</article>`;
}

/** Classement final en tableau. */
export function htmlClassementFinal(vue, equipes) {
  if (!vue.classementFinal.length) return '<p class="discret">Le classement final apparaîtra ici.</p>';
  const niveaux = [...new Set(vue.classementFinal.map((l) => l.niveau))];
  const lignes = vue.classementFinal.map((l) => {
    const niv = niveaux.length > 1 ? niveaux.indexOf(l.niveau) : -1;
    return `<tr><td class="place">${h(l.place)}</td><td>${htmlEquipe(equipes, l.equipe, l.origine)}</td><td>${l.niveau ? `<span class="pastille${niv >= 0 ? ` niv-${Math.min(niv, 3)}` : ''}">${h(l.niveau)}</span>` : ''}</td></tr>`;
  }).join('');
  return `<table class="final"><thead><tr><th>Place</th><th>Équipe</th><th>Niveau</th></tr></thead><tbody>${lignes}</tbody></table>`;
}

/** QR code en SVG pour une adresse web. */
export function htmlQr(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  let chemin = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) chemin += `M${x},${y}h1v1h-1z`;
  return `<span class="qr"><svg viewBox="-1 -1 ${n + 2} ${n + 2}" role="img" aria-label="QR code"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><path d="${chemin}" fill="#14212b"/></svg></span>`;
}

/** Accord au pluriel : pluriel(2, 'match joué', 'matchs joués') -> « 2 matchs joués ». */
export function pluriel(n, singulier, plurielTexte) {
  return `${n} ${n > 1 ? plurielTexte : singulier}`;
}

/** Texte d'une manche : « Phase 1, tour 2 ». */
export function nomManche(manche) {
  return manche ? `${manche.nomEtape}, tour ${manche.tour}` : '';
}

/** Heure lisible à partir d'une date ISO. */
export function heureCourte(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Adresse d'une page voisine (ecran.html, index.html) pour un événement donné. */
export function adressePage(page, id, extra = '') {
  const base = new URL(page, window.location.href);
  base.search = `?t=${encodeURIComponent(id)}${extra}`;
  return base.href;
}
