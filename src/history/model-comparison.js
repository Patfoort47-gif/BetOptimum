import { predictionOddsSource } from './prediction-provenance.js';
const settled = (x) =>
  ['won', 'lost'].includes(x.status) &&
  Number.isFinite(Number(x.odd ?? x.odds)) &&
  Number(x.odd ?? x.odds) > 1;
// Une unité par match de chaque côté ; dernier pari simple certifié du joueur, jamais un combiné.
export function modelComparison(bets = [], predictions = []) {
  const model = new Map(
    predictions
      .filter((p) => settled(p) && predictionOddsSource(p) === 'bookmaker')
      .map((p) => [p.id, p])
  );
  const own = new Map();
  for (const b of bets
    .slice()
    .sort(
      (a, b) =>
        String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id))
    )) {
    if (!b.certified || b.legacy || b.betType !== 'single' || b.items?.length !== 1 || !settled(b))
      continue;
    const id = b.items[0].matchId;
    if (!model.has(id) || own.has(id)) continue;
    own.set(id, b);
  }
  const pairs = [...own].map(([id, b]) => ({
    id,
    player: b.status === 'won' ? Number(b.odds) - 1 : -1,
    model: model.get(id).status === 'won' ? Number(model.get(id).odd) - 1 : -1
  }));
  const roi = (key) =>
    pairs.length ? (pairs.reduce((s, p) => s + p[key], 0) / pairs.length) * 100 : null;
  return { count: pairs.length, player: roi('player'), model: roi('model') };
}
export function comparisonCard(report) {
  if (!report.count) return null;
  const percent = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')} %`;
  return {
    title: 'Toi contre le modèle',
    filename: 'betoptimum-toi-modele.png',
    lines: [
      `${report.count} mêmes matchs · semaine en cours`,
      `Moi : ${percent(report.player)}`,
      `Modèle : ${percent(report.model)}`,
      'ROI à unité constante par match',
      'Dernier pari simple certifié par match',
      'Résultats passés, aucune garantie.'
    ]
  };
}
