import { sameTeam } from './team-match.js';
const escape = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
export function teamForm(team, history) {
  const games = history
    .filter((g) => sameTeam(g.homeTeam?.name ?? '', team) || sameTeam(g.awayTeam?.name ?? '', team))
    .filter(
      (g) => Number.isInteger(g.score?.fullTime?.home) && Number.isInteger(g.score?.fullTime?.away)
    )
    .sort((a, b) => Date.parse(b.utcDate) - Date.parse(a.utcDate))
    .slice(0, 6);
  let scored = 0,
    conceded = 0;
  const recent = games.map((g) => {
    const home = sameTeam(g.homeTeam.name, team),
      own = g.score.fullTime[home ? 'home' : 'away'],
      opp = g.score.fullTime[home ? 'away' : 'home'];
    scored += own;
    conceded += opp;
    return {
      result: own > opp ? 'V' : own === opp ? 'N' : 'D',
      opponent: g[home ? 'awayTeam' : 'homeTeam'].name,
      home: g.homeTeam.name,
      away: g.awayTeam.name,
      homeScore: g.score.fullTime.home,
      awayScore: g.score.fullTime.away,
      date: g.utcDate
    };
  });
  return {
    sample: games.length,
    form: recent.map((g) => g.result).join(''),
    recent: recent.slice(0, 5),
    avgScored: games.length ? scored / games.length : null,
    avgConceded: games.length ? conceded / games.length : null
  };
}
export function teamFormMarkup(stats, team) {
  const letters = (stats?.form ?? '').slice(0, 5).split('').reverse(),
    cells = [...Array(5 - letters.length).fill('X'), ...letters],
    recent = [...(stats?.recent ?? [])].slice(0, 5).reverse(),
    names = { V: 'Victoire', N: 'Nul', D: 'Défaite', X: 'Forme indisponible' };
  return `<button type="button" class="team-form" data-team-form aria-label="Forme récente de ${escape(team)} : ${letters.join(', ') || 'indisponible'}. Toucher pour les détails.">${cells
    .map((r, i) => {
      const game = recent[i - (5 - letters.length)],
        label = game
          ? `${names[r]} · ${game.home} ${game.homeScore} - ${game.awayScore} ${game.away}`
          : `${names[r]} · détail du match indisponible`;
      return `<span class="fd ${r}" data-form-info="${escape(label)}" title="${escape(label)}">${r === 'X' ? '' : r}</span>`;
    })
    .join('')}</button>`;
}
