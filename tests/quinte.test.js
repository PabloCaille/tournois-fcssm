import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculer } from '../src/moteur/tournoi.js';
import { creerAlea } from '../src/moteur/aleatoire.js';
import { creerTournoi, definirEquipes, tirerAuSort, definirCreneaux } from '../src/moteur/actions.js';
import { jouerMancheCourante, simulerTournoi } from '../src/moteur/simulation.js';
import { planifier, compterMatchs } from '../src/moteur/planning.js';
import { MODELES } from '../src/formats/index.js';

const reglages = MODELES.find((m) => m.id === 'quinte').planning;
const minutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

function preparer(format, cle, n, variante = null) {
  let t = creerTournoi({ format, cle, variante });
  t = definirEquipes(t, Array.from({ length: n }, (_, i) => ({ nom: `${cle}${i + 1}` }))).tournoi;
  return tirerAuSort(t, 7 + n).tournoi;
}

function jouer(t, graine) {
  const alea = creerAlea(graine);
  for (let i = 0; i < 100; i++) { const s = jouerMancheCourante(t, alea); if (s === t) break; t = s; }
  return t;
}

/** Planifie une journée, joue tout, et vérifie les garanties du planning. */
function verifierJournee(nM, nF, variante, r = reglages) {
  let M = preparer('quinte-masculin', 'M', nM);
  let F = preparer('quinte-feminin', 'F', nF, variante);
  const plan = planifier([M, F], r);
  M = jouer(definirCreneaux(M, plan.creneaux.M).tournoi, 3);
  F = jouer(definirCreneaux(F, plan.creneaux.F).tournoi, 4);
  const vues = [calculer(M), calculer(F)];
  assert.ok(vues.every((v) => v.termine), 'les deux tournois vont au bout');
  // Deux matchs ne partagent jamais le même terrain à la même heure, tournois confondus.
  const occupes = new Set();
  for (const v of vues) for (const m of v.matchs) {
    assert.ok(m.heure, `heure du match ${m.id}`);
    assert.ok(m.lieu >= 1 && m.lieu <= r.nbTerrains, 'terrain existant');
    const cle = `${m.heure}-${m.lieu}`;
    assert.ok(!occupes.has(cle), `terrain ${m.lieu} déjà pris à ${m.heure}`);
    occupes.add(cle);
  }
  // Une équipe ne joue jamais deux matchs en même temps, et respecte la pause minimale.
  for (const v of vues) {
    const parEquipe = new Map();
    for (const m of v.matchs) for (const e of [m.a, m.b]) {
      if (!parEquipe.has(e)) parEquipe.set(e, []);
      parEquipe.get(e).push(minutes(m.heure));
    }
    for (const [e, heures] of parEquipe) {
      heures.sort((x, y) => x - y);
      for (let i = 1; i < heures.length; i++) {
        assert.ok(heures[i] - heures[i - 1] >= r.duree + r.pause, `équipe ${e} : repos insuffisant (${heures[i - 1]} puis ${heures[i]})`);
      }
    }
  }
  return { plan, vues };
}

test('quinte : journée type (22 équipes masculines, 8 féminines) dans les horaires', () => {
  const { plan, vues } = verifierJournee(22, 8, 'A');
  assert.equal(plan.depasse, false, `fin prévue à ${plan.fin}`);
  assert.equal(plan.debut, '09:00');
  assert.equal(plan.nbMatchs, vues[0].matchs.length + vues[1].matchs.length);
  assert.equal(vues[1].matchs.length, 28, '8 équipes en toutes contre toutes = 28 matchs');
  assert.equal(vues[1].classementFinal.length, 8);
});

test('quinte : le rythme masculin/féminin est réglable et change le planning', () => {
  const M = preparer('quinte-masculin', 'M', 22);
  const F = preparer('quinte-feminin', 'F', 8, 'A');
  const a = planifier([M, F], { ...reglages, rythme: { M: 3, F: 1 } });
  const b = planifier([M, F], { ...reglages, rythme: { M: 1, F: 1 } });
  assert.notDeepEqual(a.creneaux.F, b.creneaux.F);
  // Avec moins de terrains, la journée dure plus longtemps et l'outil le signale.
  const c = planifier([M, F], { ...reglages, nbTerrains: 2 });
  assert.ok(minutes(c.fin) > minutes(a.fin));
  assert.equal(c.depasse, true);
});

test('quinte féminine : 8 à 12 équipes, les deux formules, avec planning', () => {
  for (let n = 8; n <= 12; n++) {
    for (const variante of ['A', 'B']) verifierJournee(20, n, variante, { ...reglages, fin: '23:00' });
  }
});

test('quinte masculine : tous les effectifs de 12 à 32', () => {
  for (let n = 12; n <= 32; n++) {
    const vue = calculer(simulerTournoi({ format: 'quinte-masculin', n, graine: n }));
    assert.equal(vue.termine, true);
    assert.equal(new Set(vue.classementFinal.map((l) => l.equipe)).size, n);
    assert.deepEqual(vue.alertes.filter((a) => a.type === 'meme-poule'), []);
  }
});

test('comparaison des formules féminines : nombre de matchs', () => {
  const a = compterMatchs({ format: 'quinte-feminin', variante: 'A', n: 8 });
  const b = compterMatchs({ format: 'quinte-feminin', variante: 'B', n: 8 });
  assert.deepEqual([a.total, a.parEquipeMin, a.parEquipeMax], [28, 7, 7]);
  assert.deepEqual([b.total, b.parEquipeMin, b.parEquipeMax], [18, 4, 5]);
});

test('phase finale de quinte : pas de nul, tirs au but indiqués par le vainqueur', () => {
  const t = simulerTournoi({ format: 'quinte-feminin', variante: 'B', n: 8, graine: 2 });
  const vue = calculer(t);
  assert.equal(vue.parametres.departageFinale, 'Tirs au but');
  assert.ok(vue.matchs.some((m) => m.id.endsWith(':F') && m.vainqueur));
});
