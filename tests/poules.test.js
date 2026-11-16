import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taillesPoules, calendrierPoule, lettrePoule } from '../src/moteur/poules.js';

test('tailles des poules : 4, complétées par des poules de 3', () => {
  assert.deepEqual(taillesPoules(64), Array(16).fill(4));
  assert.deepEqual(taillesPoules(32), Array(8).fill(4));
  assert.deepEqual(taillesPoules(60), Array(15).fill(4));
  assert.deepEqual(taillesPoules(57), [...Array(12).fill(4), 3, 3, 3]);
  assert.deepEqual(taillesPoules(30), [4, 4, 4, 4, 4, 4, 3, 3]);
  assert.deepEqual(taillesPoules(6), [3, 3]);
  assert.deepEqual(taillesPoules(5), [5]);
  for (let n = 6; n <= 130; n++) {
    const t = taillesPoules(n);
    assert.equal(t.reduce((a, b) => a + b, 0), n);
    assert.ok(t.every((x) => x === 3 || x === 4), `n=${n} : ${t}`);
  }
});

test('calendrier de poule de 4 identique au Sheet', () => {
  assert.deepEqual(calendrierPoule(4), [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]]);
});

test('calendrier : chaque paire une seule fois, jamais deux matchs par tour pour une équipe', () => {
  for (let n = 2; n <= 12; n++) {
    const tours = calendrierPoule(n);
    const paires = new Set();
    for (const tour of tours) {
      const vues = new Set();
      for (const [a, b] of tour) {
        assert.ok(!vues.has(a) && !vues.has(b));
        vues.add(a); vues.add(b);
        paires.add(`${a}-${b}`);
      }
    }
    assert.equal(paires.size, (n * (n - 1)) / 2, `n=${n}`);
  }
});

test('noms de poules', () => {
  assert.equal(lettrePoule(0), 'A');
  assert.equal(lettrePoule(15), 'P');
  assert.equal(lettrePoule(26), 'AA');
});
