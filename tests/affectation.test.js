import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entrantsParNiveau, repartir, repartitionValide } from '../src/moteur/affectation.js';
import { lettrePoule, taillesPoules } from '../src/moteur/poules.js';
import palets from '../src/formats/palets.js';
import cornhole from '../src/formats/cornhole.js';

const sources = (n) => taillesPoules(n).map((taille, i) => ({ id: lettrePoule(i), taille }));
const lire = (poule) => poule.map((e) => `${e.groupe}${e.rang}`);

test('palets 64 : phase 2 identique au Sheet (P1 = 1ers de A, E, I, M)', () => {
  const def = palets.etapes[1];
  const niveaux = entrantsParNiveau(sources(64), def.niveaux).map((e) => repartir(e, def.repartition));
  assert.deepEqual(niveaux[0].map(lire), [['A1', 'E1', 'I1', 'M1'], ['B1', 'F1', 'J1', 'N1'], ['C1', 'G1', 'K1', 'O1'], ['D1', 'H1', 'L1', 'P1']]);
  assert.deepEqual(lire(niveaux[1][0]), ['A2', 'E2', 'I2', 'M2']);
  assert.deepEqual(lire(niveaux[3][3]), ['D4', 'H4', 'L4', 'P4']);
});

test("cornhole 32 : poules de l'après-midi identiques au Sheet", () => {
  const def = cornhole.etapes[1];
  const [principale, consolante] = entrantsParNiveau(sources(32), def.niveaux).map((e) => repartir(e, def.repartition));
  assert.deepEqual(principale.map(lire), [['A1', 'H1', 'D2', 'E2'], ['B1', 'G1', 'C2', 'F2'], ['C1', 'F1', 'B2', 'G2'], ['D1', 'E1', 'A2', 'H2']]);
  assert.deepEqual(consolante.map(lire), [['A3', 'H3', 'D4', 'E4'], ['B3', 'G3', 'C4', 'F4'], ['C3', 'F3', 'B4', 'G4'], ['D3', 'E3', 'A4', 'H4']]);
});

test('jamais deux équipes de la même poule ensemble, quel que soit le nombre', () => {
  for (const format of [palets, cornhole]) {
    const def = format.etapes[1];
    for (let n = 8; n <= 100; n++) {
      const src = sources(n);
      const parNiveau = entrantsParNiveau(src, def.niveaux);
      assert.equal(parNiveau.flat().length, n, `${format.id} n=${n} : toutes les équipes sont placées`);
      for (const entrants of parNiveau) {
        const poules = repartir(entrants, def.repartition);
        assert.ok(repartitionValide(poules), `${format.id} n=${n} : ${JSON.stringify(poules.map(lire))}`);
      }
    }
  }
});
