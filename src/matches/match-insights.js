// Données observées uniquement, aucune substitution par les buts du modèle.
const score = (t) => t?.score?.value ?? t?.score;
export function matchInsights(summary = {}, schedules = [], ids = {}, kickoff = Infinity) {
  const before = (g) =>
      Number.isFinite(Date.parse(g.gameDate ?? g.date)) &&
      Date.parse(g.gameDate ?? g.date) < Number(kickoff),
    sort = (a, b) => Date.parse(b.date) - Date.parse(a.date);
  const games = [
    ...new Map(
      schedules
        .flatMap((s) => s?.events ?? [])
        .filter((e) => before(e) && e.competitions?.[0]?.status?.type?.state === 'post')
        .map((e) => [e.id, e])
    ).values()
  ];
  const form = Object.fromEntries(
    ['home', 'away'].map((side) => {
      const id = String(ids[side]),
        recent = (summary.lastFiveGames ?? []).find((g) => String(g.team?.id) === id)?.events;
      const rows = recent?.length
        ? recent.filter(before).map((g) => ({
            date: g.gameDate ?? g.date,
            result: g.gameResult,
            score: g.score ?? '',
            opponent: g.opponent?.displayName ?? ''
          }))
        : games.flatMap((e) => {
            const teams = e.competitions[0].competitors ?? [],
              me = teams.find((t) => String(t.team?.id) === id),
              other = teams.find((t) => t !== me);
            if (
              !me ||
              !other ||
              !Number.isFinite(Number(score(me))) ||
              !Number.isFinite(Number(score(other)))
            )
              return [];
            return [
              {
                date: e.date,
                result:
                  Number(score(me)) > Number(score(other))
                    ? 'W'
                    : Number(score(me)) < Number(score(other))
                      ? 'L'
                      : 'D',
                score: `${score(me)} - ${score(other)}`,
                opponent: other.team?.displayName ?? ''
              }
            ];
          });
      return [side, rows.sort(sort).slice(0, 5)];
    })
  );
  const h2h = games
    .flatMap((e) => {
      const teams = e.competitions[0].competitors ?? [],
        home = teams.find((t) => t.homeAway === 'home'),
        away = teams.find((t) => t.homeAway === 'away'),
        pair = teams.map((t) => String(t.team?.id));
      if (
        !home ||
        !away ||
        !pair.includes(String(ids.home)) ||
        !pair.includes(String(ids.away)) ||
        score(home) == null ||
        score(away) == null
      )
        return [];
      return [
        {
          id: e.id,
          date: e.date,
          home: home.team.displayName,
          away: away.team.displayName,
          score: `${score(home)} - ${score(away)}`
        }
      ];
    })
    .sort(sort)
    .slice(0, 5);
  const values = ['home', 'away'].map((side) => {
    const stat = summary.boxscore?.teams
        ?.find((t) => String(t.team?.id) === String(ids[side]))
        ?.statistics?.find((s) =>
          ['expectedGoals', 'totalExpectedGoals', 'expectedGoalsTotal'].includes(s.name)
        ),
      raw = stat?.value ?? stat?.displayValue;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  });
  return {
    form,
    h2h,
    xg: values.every((v) => v !== null) ? { home: values[0], away: values[1] } : null
  };
}

const sides = ['home', 'away'];
const goalPair = (values) =>
  sides.every((side) => Number.isFinite(values?.[side]) && values[side] > 0 && values[side] <= 10);

export function prematchProjection(match, previous, previousGeneratedAt, capturedAt) {
  if (match.voided) return null;
  const kickoff = Date.parse(match.kickoff);
  const from = (item, at) => {
    const goals = { home: item?.homeGoals, away: item?.awayGoals };
    return item &&
      !item.completed &&
      !item.voided &&
      item.analysisStatus !== 'unavailable' &&
      Date.parse(at) < kickoff &&
      goalPair(goals)
      ? { ...goals, capturedAt: at }
      : null;
  };
  if (!match.completed && Date.parse(capturedAt) < kickoff) return from(match, capturedAt);
  const saved = previous?.prematchGoals;
  if (goalPair(saved) && Date.parse(saved.capturedAt) < kickoff) return saved;
  return from(previous, previousGeneratedAt);
}

export function recentXg(match, pastMatches, feed, cutoff) {
  const recent = { home: [], away: [] };
  for (const previous of pastMatches) {
    const kickoff = Date.parse(previous.kickoff);
    const xg = feed?.[previous.id];
    if (
      previous.id === match.id ||
      !previous.completed ||
      previous.voided ||
      !(kickoff < cutoff) ||
      !['PitchAPI', 'Sportmonks'].includes(xg?.source) ||
      !sides.every((side) => Number.isFinite(xg[side]) && xg[side] >= 0)
    )
      continue;
    for (const side of sides) {
      const id = match[side + 'Id'];
      if (!id) continue;
      const playedAs = sides.find((position) => String(previous[position + 'Id']) === String(id));
      if (!playedAs) continue;
      const opponent = playedAs === 'home' ? 'away' : 'home';
      recent[side].push({ id: previous.id, kickoff, for: xg[playedAs], against: xg[opponent] });
    }
  }
  return Object.fromEntries(
    sides.map((side) => {
      const games = recent[side]
        .sort((a, b) => b.kickoff - a.kickoff)
        .filter((game, index, list) => list.findIndex((row) => row.id === game.id) === index)
        .slice(0, 5);
      const mean = (field) => games.reduce((sum, game) => sum + game[field], 0) / games.length;
      return [
        side,
        games.length ? { count: games.length, for: mean('for'), against: mean('against') } : null
      ];
    })
  );
}
