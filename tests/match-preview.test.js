import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchPreview, matchPreviewMarkup } from '../src/matches/match-preview.js';
const now = Date.parse('2026-11-10T06:00:00Z'),
  base = {
    home: 'Alpha',
    away: 'Beta',
    kickoff: '2026-11-10T19:00:00Z',
    homeGoals: 1.7,
    awayGoals: 1.2,
    suggestedPick: { key: 'home', label: 'Alpha gagne', probability: 0.6 }
  };
test('BET-320 : deux phrases factuelles, données observées ou estimations distinguées, coût nul', () => {
  const a = buildMatchPreview(
    {
      ...base,
      homeStats: { sample: 4, avgScored: 2 },
      awayStats: { sample: 6, avgScored: 1.5 },
      knockout: true
    },
    now
  );
  assert.equal(a.lines.length, 2);
  assert.match(a.lines[0], /2,0.*4 matchs/);
  assert.match(a.lines[1], /Élimination directe.*60 %.*Aucune garantie/);
  assert.equal(a.costEur, 0);
  const b = buildMatchPreview({ ...base, suggestedPick: null }, now);
  assert.match(b.lines[0], /Buts estimés/);
  assert.match(b.lines[1], /Pas de sélection admissible/);
  assert.doesNotMatch(b.lines.join(' '), /enjeu|blessure|certain/);
});
test('BET-320 : aucun texte après coup d’envoi et données échappées', () => {
  for (const m of [
    { ...base, completed: true },
    { ...base, voided: true },
    { ...base, kickoff: new Date(now).toISOString() }
  ])
    assert.equal(buildMatchPreview(m, now), null);
  const html = matchPreviewMarkup({
    ...base,
    preview: { version: 1, lines: ['<img onerror=bad()>', 'Estimation, aucune garantie'] }
  });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.equal(matchPreviewMarkup(base), '');
});
