// BET-169 : étude uniquement. Ne remplace aucun moteur de règlement.
import { leaguePoints } from './model.js';
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export function comparePlayer(entries, { k = 10, threshold = 10 } = {}) {
  if (!(k > 0) || !Number.isInteger(threshold) || threshold < 1)
    throw new Error('Paramètres invalides');
  entries = entries.filter((e) => e.kind !== 'multiple');
  const decided = entries.filter((e) => ['won', 'lost'].includes(e.status));
  for (const e of decided)
    if (!Number.isFinite(Number(e.odd)) || Number(e.odd) < 1) throw new Error('Cote invalide');
  const n = decided.length,
    wins = decided.filter((e) => e.status === 'won').length,
    raw = round(entries.reduce((s, e) => s + leaguePoints({ status: e.status, odds: e.odd }), 0)),
    positive = round(
      entries.reduce((s, e) => s + Math.max(0, leaguePoints({ status: e.status, odds: e.odd })), 0)
    );
  return {
    n,
    wins,
    roi: n ? round((raw / (n * 10)) * 100) : 0,
    raw,
    positive,
    weighted: round((raw * n) / (n + k)),
    confirmed: n >= threshold,
    threshold,
    k
  };
}
export function compareRanking(players, variant = 'raw', params = {}) {
  if (!['raw', 'positive', 'weighted', 'threshold'].includes(variant))
    throw new Error('Variante invalide');
  const rows = Object.entries(players).map(([player, entries]) => ({
    player,
    ...comparePlayer(entries, params)
  }));
  return rows.sort(
    (a, b) =>
      (variant === 'threshold' ? Number(b.confirmed) - Number(a.confirmed) : 0) ||
      b[variant === 'threshold' ? 'raw' : variant] - a[variant === 'threshold' ? 'raw' : variant] ||
      b.roi - a.roi ||
      b.wins - a.wins ||
      a.player.localeCompare(b.player)
  );
}
export function controlledSeries(n, wins, odd = 2) {
  return Array.from({ length: n }, (_, i) => ({ status: i < wins ? 'won' : 'lost', odd }));
}
