import { matchedFixtures } from './publish-match-xg.mjs';

const leagues = [
  ['Europa League', 'uel', 5],
  ['Conference League', 'uecl', 2286]
];
const key = process.env.STRIKERAPI_API_KEY;
if (!key) throw new Error('Secret STRIKERAPI_API_KEY absent');

async function request(endpoint, body) {
  const response = await fetch('https://mcp.strikerapi.com/v1/' + endpoint, {
    method: 'POST',
    headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`StrikerAPI HTTP ${response.status}`);
  const data = await response.json();
  const payload = data.result ?? data.data ?? data;
  const content = payload.content?.find((item) => item.type === 'text');
  const result = payload.structuredContent ?? (content ? JSON.parse(content.text) : payload);
  console.log(
    '::notice::Structure ' +
      endpoint +
      ' : ' +
      Object.keys(data).join(',') +
      ' / ' +
      Object.keys(result).join(',')
  );
  return result;
}

const read = async (file) => {
  const response = await fetch('https://pronosafe.fr/data/' + file, {
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Calendrier public HTTP ${response.status}`);
  const data = await response.json();
  const payload = data.result ?? data.data ?? data;
  const content = payload.content?.find((item) => item.type === 'text');
  const result = payload.structuredContent ?? (content ? JSON.parse(content.text) : payload);
  console.log(
    '::notice::Structure ' +
      endpoint +
      ' : ' +
      Object.keys(data).join(',') +
      ' / ' +
      Object.keys(result).join(',')
  );
  return result;
};
const [{ matches }, existing] = await Promise.all([read('fixtures.json'), read('match-xg.json')]);
const missing = matches.filter((match) => match.completed && !match.voided && !existing[match.id]);
let remainingChecks = 15;
for (const [name, league, leagueId] of leagues) {
  const pending = missing.filter((match) => match.league === name);
  if (!pending.length) continue;
  const dates = pending.map((match) => match.kickoff.slice(0, 10)).sort();
  const first = dates[0];
  const last = dates.at(-1);
  const { games } = await request('list_games', {
    season: Number(first.slice(0, 4)) - (Number(first.slice(5, 7)) < 7 ? 1 : 0),
    league,
    from: first,
    to: last,
    status: 'final',
    limit: 100
  });
  if (!Array.isArray(games)) throw new Error('Calendrier StrikerAPI invalide');
  const fixtures = games.map((game) => ({
    id: game.game_id,
    league_id: leagueId,
    starting_at_timestamp: Date.parse(game.starts_at) / 1000,
    participants: [
      { name: game.home?.name, meta: { location: 'home' } },
      { name: game.away?.name, meta: { location: 'away' } }
    ]
  }));
  const linked = [...matchedFixtures(pending, fixtures)];
  const checked = linked.slice(0, remainingChecks);
  remainingChecks -= checked.length;
  let covered = 0;
  for (const [, fixture] of checked) {
    const result = await request('get_game', { league, game_id: fixture.id });
    if (String(result.game?.game_id) !== String(fixture.id) || result.game.status !== 'final')
      continue;
    const pair = [true, false].map(
      (side) => result.team_stats?.find((team) => team.home === side)?.xg
    );
    if (pair.every((value) => Number.isFinite(value) && value >= 0)) covered++;
  }
  console.log(
    '::notice::' +
      JSON.stringify({
        competition: name,
        missing: pending.length,
        providerGames: games.length,
        linked: linked.length,
        checked: checked.length,
        withBothXg: covered
      })
  );
}
