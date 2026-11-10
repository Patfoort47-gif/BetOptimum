// Source simulée : réponses de cinq lignes, aucun compte ni service distant.
async function mountHistory(p) {
  await p.evaluate(async () => {
    const { initPersonalDashboard } = await import('/personal-dashboard.js');
    const now = Date.now();
    window.__h = {
      calls: [],
      fail: false,
      empty: false,
      delay: 150,
      netOverride: null,
      rows: Array.from({ length: 25 }, (_, i) => ({
        id: `00000000-0000-0000-0000-${String(25 - i).padStart(12, '0')}`,
        placed_at: new Date(now - i * 1000 - 1000).toISOString(),
        settled_at: i < 20 ? new Date(now).toISOString() : null,
        status: i < 20 ? 'won' : 'pending',
        stake: 10,
        payout: i < 20 ? 12.5 : 0,
        odds: 1.25,
        bet_type: 'single',
        selections: [{ match: 'A - B', key: 'home', label: 'A', odd: 1.25 }]
      }))
    };
    window.__dash = initPersonalDashboard({
      root: document.querySelector('#bankroll'),
      api: {
        personalHistory: async (f) => {
          __h.calls.push(JSON.parse(JSON.stringify(f)));
          await new Promise((r) => setTimeout(r, __h.delay));
          if (__h.fail) {
            __h.fail = false;
            throw new Error('Chargement impossible');
          }
          const anchor = f.cursor?.snapshot_at ?? new Date().toISOString(),
            filtered = (__h.empty ? [] : __h.rows)
              .filter(
                (r) =>
                  r.placed_at <= anchor &&
                  (f.status === 'all' ||
                    r.status === f.status ||
                    (f.status === 'settled' && r.status !== 'pending')) &&
                  (!f.search || JSON.stringify(r.selections).includes(f.search))
              )
              .sort((a, b) => b.placed_at.localeCompare(a.placed_at) || b.id.localeCompare(a.id)),
            decided = filtered.filter((r) => ['won', 'lost'].includes(r.status)),
            settled = filtered.filter((r) => r.status !== 'pending'),
            net = __h.empty
              ? 0
              : (__h.netOverride ?? settled.reduce((n, r) => n + r.payout - r.stake, 0)),
            batch = filtered.filter(
              (r) =>
                !f.cursor ||
                r.placed_at < f.cursor.placed_at ||
                (r.placed_at === f.cursor.placed_at && r.id < f.cursor.id)
            ),
            rows = batch.slice(0, 5),
            last = rows.at(-1);
          return {
            rows,
            total: filtered.length,
            has_more: batch.length > 5,
            next_cursor:
              batch.length > 5
                ? { placed_at: last.placed_at, id: last.id, snapshot_at: anchor }
                : null,
            summary: {
              bankroll: 950,
              net,
              decided_staked: decided.reduce((n, r) => n + r.stake, 0),
              staked: filtered.reduce((n, r) => n + r.stake, 0),
              engaged: filtered
                .filter((r) => r.status === 'pending')
                .reduce((n, r) => n + r.stake, 0),
              returned: decided.reduce((n, r) => n + r.stake, 0) + net,
              settled: settled.length,
              wins: decided.filter((r) => r.status === 'won').length,
              decided: decided.length,
              potential: 62.5,
              total: filtered.length,
              won: decided.filter((r) => r.status === 'won').length,
              lost: 0,
              pending: filtered.filter((r) => r.status === 'pending').length,
              void: 0
            },
            curve: [],
            bars: [],
            openingDate: '2026-11-01'
          };
        }
      }
    });
    __dash.load();
  });
}
module.exports = { mountHistory };
