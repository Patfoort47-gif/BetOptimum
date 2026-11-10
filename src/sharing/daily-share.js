const SYMBOLS = { won: '🟩', lost: '🟥', void: '⬜', voided: '⬜', pending: '🟨' };
export function dailyShare(challenge, choices = []) {
  if (!challenge?.date || !challenge.picks?.length) return null;
  const mine = new Map(choices.filter((c) => c.day === challenge.date).map((c) => [c.match_id, c]));
  if (!challenge.picks.some((p) => mine.has(p.matchId))) return null;
  const squares = challenge.picks.map((p) => SYMBOLS[mine.get(p.matchId)?.status] ?? '⬜').join('');
  const settled = choices
    .filter((c) => ['won', 'lost'].includes(c.status))
    .slice()
    .sort(
      (a, b) =>
        String(b.placed_at ?? b.day).localeCompare(String(a.placed_at ?? a.day)) ||
        String(b.id).localeCompare(String(a.id))
    );
  let streak = 0;
  for (const c of settled) {
    if (c.status !== 'won') break;
    streak++;
  }
  return {
    title: 'Mon défi du jour',
    filename: `betoptimum-defi-${challenge.date}.png`,
    lines: [
      challenge.date,
      squares,
      `Série : ${streak === settled.length && streak > 0 ? 'au moins ' : ''}${streak} bon${streak > 1 ? 's' : ''} prono${streak > 1 ? 's' : ''} réglé${streak > 1 ? 's' : ''}`,
      `Ordre des choix, historique chargé (200 max.)`,
      '🟩 gagné · 🟥 perdu · 🟨 en attente · ⬜ autre',
      'Joue le défi du jour sur BetOptimum !'
    ]
  };
}
