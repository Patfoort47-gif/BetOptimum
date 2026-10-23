// BET-91 : chronologie des mises, règlements et mouvements de capital, sans dépendance externe.
const DAY = 864e5;
const paris = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
const euros = value => Number(value).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function buildAnalytics({ bets = [], capitalEvents = [], initial = 1000, period = 'all', now = Date.now() } = {}) {
  const until = Number(new Date(now)), after = period === 'all' ? -Infinity : until - Number(period) * DAY, events = [], ids = new Set();
  for (const bet of bets) {
    if (bet.id && ids.has(bet.id)) continue;
    if (bet.id) ids.add(bet.id);
    const placed = Date.parse(bet.date ?? bet.placed_at), stake = number(bet.stake);
    if (!Number.isFinite(placed) || placed > until) continue;
    events.push({ time: placed, balance: -stake, volume: 1, profit: 0, capital: 0, settled: 0, wins: 0 });
    if (['won', 'lost', 'void'].includes(bet.status)) {
      const settled = Math.max(placed, Date.parse(bet.settledAt ?? bet.settled_at ?? bet.date ?? bet.placed_at));
      if (!Number.isFinite(settled) || settled > until) continue;
      const payout = bet.status === 'lost' ? 0 : number(bet.returnAmount ?? bet.payout ?? (bet.status === 'void' ? stake : stake * number(bet.odds)));
      events.push({ time: settled, balance: payout, volume: 0, capital: 0, profit: bet.status === 'void' ? 0 : payout - stake, settled: bet.status === 'void' ? 0 : 1, wins: bet.status === 'won' ? 1 : 0 });
    }
  }
  for (const event of capitalEvents) {
    const time = Date.parse(event.date ?? event.created_at);
    if (Number.isFinite(time) && time <= until) events.push({ time, balance: number(event.amount), capital: number(event.amount), profit: 0, volume: 0, settled: 0, wins: 0 });
  }
  events.sort((a, b) => a.time - b.time);
  let balance = number(initial), opening = balance;
  const filtered = events.filter(event => { if (event.time < after) { balance += event.balance; opening = balance; return false; } return true; });
  const days = filtered.length ? Math.ceil((until - filtered[0].time) / DAY) : 0, granularity = days > 180 ? 'mois' : days > 31 ? 'semaine' : 'jour';
  const bucket = time => {
    const day = paris.format(new Date(time));
    if (granularity === 'mois') return day.slice(0, 7);
    if (granularity === 'semaine') { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); return date.toISOString().slice(0, 10); }
    return day;
  };
  const groups = new Map();
  let profit = 0, capital = 0, wins = 0, settled = 0, volume = 0;
  for (const event of filtered) {
    balance += event.balance; profit += event.profit; capital += event.capital; wins += event.wins; settled += event.settled; volume += event.volume;
    const key = bucket(event.time), previous = groups.get(key);
    groups.set(key, { date: key, balance, profit: (previous?.profit ?? 0) + event.profit, capital: (previous?.capital ?? 0) + event.capital, volume: (previous?.volume ?? 0) + event.volume, settled: (previous?.settled ?? 0) + event.settled, wins: (previous?.wins ?? 0) + event.wins, winrate: settled ? wins / settled * 100 : null });
  }
  return { rows: [...groups.values()], opening, balance, profit, capital, wins, settled, volume, winrate: settled ? wins / settled * 100 : null, granularity };
}

function graph(rows, key, label, { bars = false, baseline = null } = {}) {
  const values = rows.map(row => row[key]).filter(value => value != null), floor = Math.min(...values, baseline ?? Infinity), ceiling = Math.max(...values, baseline ?? -Infinity), pad = (ceiling - floor || Math.max(1, Math.abs(ceiling) * .1)) * .15, min = key === 'balance' ? floor - pad : Math.min(0, ...values), max = key === 'balance' ? ceiling + pad : Math.max(key === 'winrate' ? 100 : 1, ...values), range = max - min || 1;
  const x = index => 42 + (rows.length === 1 ? .5 : index / (rows.length - 1)) * 616, y = value => 190 - (value - min) / range * 156;
  const format = value => key === 'winrate' ? `${value.toFixed(1)} %` : key === 'volume' ? `${value} pari${value > 1 ? 's' : ''}` : euros(value);
  const points = rows.map((row, index) => row[key] == null ? '' : `${x(index)},${y(row[key])}`).filter(Boolean).join(' ');
  const width = Math.min(36, 470 / Math.max(1, rows.length)), ticks = key === 'volume' ? [...new Set([0, Math.ceil(max / 2), Math.ceil(max)])] : [min, min + range / 2, max];
  const marks = rows.map((row, index) => {
    if (row[key] == null) return '';
    const text = `${row.date} : ${format(row[key])}`, attrs = `tabindex="0" role="button" aria-label="${esc(text)}" data-chart-value="${esc(text)}"`;
    return bars ? `<rect ${attrs} x="${x(index) - width / 2}" y="${Math.min(y(0), y(row[key]))}" width="${width}" height="${Math.max(2, Math.abs(y(0) - y(row[key])))}" rx="3" class="${row[key] < 0 ? 'chart-loss' : 'chart-gain'}"><title>${esc(text)}</title></rect>` : `<circle ${attrs} cx="${x(index)}" cy="${y(row[key])}" r="5"><title>${esc(text)}</title></circle>`;
  }).join('');
  return `<svg viewBox="0 0 700 230" role="group" aria-label="${esc(label)}" class="analytics-svg"><line x1="42" y1="${y(Math.min(max, Math.max(min, 0)))}" x2="658" y2="${y(Math.min(max, Math.max(min, 0)))}" class="analytics-axis"/>${ticks.map(value => `<line x1="42" y1="${y(value)}" x2="658" y2="${y(value)}" class="analytics-grid"/>`).join('')}${bars ? '' : `<polygon points="42,190 ${points} 658,190" class="analytics-area"/><polyline points="${points}" class="analytics-line"/>`}${marks}${ticks.map(value => `<text class="analytics-tick" x="42" y="${y(value) - 6}">${esc(format(value))}</text>`).join('')}<text x="42" y="218">${esc(rows[0]?.date ?? '')}</text><text x="658" y="218" text-anchor="end">${esc(rows.at(-1)?.date ?? '')}</text></svg>`;
}

export function initAnalytics(root) {
  let source = 'model', period = '30', state = null;
  if (!root?.addEventListener) return { render() {} };
  function render(next = state) {
    state = next; if (!state) return;
    const personal = source === 'personal', certified = Boolean(state.serverReady);
    const bets = personal ? (certified ? state.serverBets : state.legacy) : (state.predictionHistory ?? []).filter(row => ['won', 'lost'].includes(row.status)).map(row => ({ ...row, date: `${row.date}T12:00:00+02:00`, settledAt: `${row.date}T12:00:00+02:00`, stake: 10, odds: row.odd, returnAmount: row.status === 'won' ? number(row.odd) * 10 : 0 }));
    const report = buildAnalytics({ bets, initial: personal ? state.initial : 100, capitalEvents: personal ? state.capitalEvents : [], period });
    const tiles = [['Solde en fin de période', euros(report.balance)], ['Gains / pertes réalisés', euros(report.profit)], ['Apports / retraits nets', euros(report.capital)], ['Réussite', report.winrate == null ? '-' : `${report.winrate.toFixed(1)} %`]];
    const chart = (key, title, description, options) => `<article class="analytics-card"><header><h4>${title}</h4><p>${description}</p></header>${report.rows.length ? graph(report.rows, key, title, options) : '<p class="empty">Aucun mouvement sur cette période. Choisissez une autre période ou placez votre premier pari.</p>'}</article>`;
    root.innerHTML = `<div class="analytics-head"><div><p class="eyebrow">VOTRE TRAJECTOIRE</p><h3>Les performances en un regard</h3></div><div class="analytics-controls"><label>Données<select data-analytics-source><option value="personal" ${personal ? 'selected' : ''}>Mes paris</option><option value="model" ${personal ? '' : 'selected'}>Pronostics du site</option></select></label><label>Période<select data-analytics-period>${[['7', '7 jours'], ['30', '30 jours'], ['90', '3 mois'], ['365', '12 mois'], ['all', 'Depuis le début']].map(([value, label]) => `<option value="${value}" ${period === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div></div><p class="analytics-note">${personal ? certified ? 'Votre bankroll certifiée : mises au placement, retours au règlement. Les anciens paris restent consultables dans votre profil.' : 'Historique personnel du navigateur. Connectez-vous pour afficher votre bankroll certifiée.' : 'Simulation des pronostics du site : capital initial de 100 €, mise fixe de 10 € par pronostic. Ces graphiques utilisent leurs propres filtres de période.'} Les remboursements sont exclus du taux de réussite et des gains réalisés.</p><div class="analytics-kpis">${tiles.map(([label, value]) => `<div><small>${label}</small><strong>${value}</strong></div>`).join('')}</div><div class="analytics-grid-cards">${chart('balance', personal ? 'Évolution de ma bankroll' : 'Capital simulé du modèle', `Solde de départ de la période : ${euros(report.opening)}. Apports et retraits inclus.`, { baseline: report.opening })}${chart('profit', 'Gains et pertes réalisés', `Par ${report.granularity} · hors apports, retraits et mises en attente.`, { bars: true })}${chart('winrate', 'Taux de réussite', 'Cumul sur la période · paris gagnés / paris réglés, en %.')}${chart('volume', 'Volume de paris', `Paris placés par ${report.granularity} · y compris en attente et remboursés.`, { bars: true })}</div><output class="analytics-tooltip" aria-live="polite">Survolez, touchez ou sélectionnez un point pour lire sa valeur.</output>${report.rows.length ? `<details class="analytics-data"><summary>Consulter les données des graphiques</summary><div class="analytics-table-wrap"><table><caption>Résultats par ${report.granularity} · heure de Paris</caption><thead><tr><th>Période</th><th>Solde</th><th>Gains / pertes</th><th>Capital</th><th>Paris placés</th><th>Réglés</th><th>Réussite cumulée</th></tr></thead><tbody>${report.rows.map(row => `<tr><th>${row.date}</th><td>${euros(row.balance)}</td><td>${euros(row.profit)}</td><td>${euros(row.capital)}</td><td>${row.volume}</td><td>${row.settled}</td><td>${row.winrate == null ? '-' : row.winrate.toFixed(1) + ' %'}</td></tr>`).join('')}</tbody></table></div></details>` : ''}`;
  }
  root.addEventListener('change', event => { if (event.target.matches('[data-analytics-source]')) source = event.target.value; else if (event.target.matches('[data-analytics-period]')) period = event.target.value; else return; const selector = event.target.matches('[data-analytics-source]') ? '[data-analytics-source]' : '[data-analytics-period]'; render(); root.querySelector(selector)?.focus(); });
  const inspect = event => { const point = event.target.closest?.('[data-chart-value]'); if (point) root.querySelector('output').textContent = point.dataset.chartValue; };
  for (const name of ['pointerover', 'click', 'focusin']) root.addEventListener(name, inspect);
  root.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key) && event.target.matches('[data-chart-value]')) { event.preventDefault(); inspect(event); } });
  return { render };
}
