// Nouveau marché : ne jamais utiliser un score après prolongation comme score à 90 minutes.
export function regulationScore(event) {
  const competition = event?.competitions?.[0] ?? {},
    status = event?.status ?? competition.status ?? {},
    type = status.type ?? {},
    teams = competition.competitors ?? [],
    home = teams.find((t) => t.homeAway === 'home'),
    away = teams.find((t) => t.homeAway === 'away'),
    extra =
      Number(status.period) > 2 ||
      /EXTRA|AET|PEN|SHOOTOUT/i.test(type.name ?? '') ||
      /extra time|penalt|after extra/i.test(type.detail ?? '');
  if (!extra) return null;
  const halves = (team) => {
    const rows = team?.linescores;
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const first = rows.slice(0, 2).map((row) => (row.value == null ? NaN : Number(row.value)));
    return first.every(Number.isInteger) && first.every((n) => n >= 0) ? first[0] + first[1] : null;
  };
  return { extraTime: true, home: halves(home), away: halves(away) };
}
