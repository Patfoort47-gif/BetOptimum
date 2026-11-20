import { decimal } from '../core/number-format.js';
import { marketSpec } from '../model/markets.js';
import { selectionResult, settleTicket } from '../model/model.js';
const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
  );
const money = (value) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
const labels = { won: '✓ Gagné', lost: '× Perdu', void: '↩ Remboursé', pending: '◷ En attente' };
export function ticketAmounts(bet) {
  const pending = bet.status === 'pending',
    returned = pending
      ? null
      : Number.isFinite(bet.returnAmount)
        ? bet.returnAmount
        : bet.certified
          ? null
          : bet.status === 'won'
            ? bet.stake * bet.odds
            : bet.status === 'void'
              ? bet.stake
              : 0;
  const validAmount = (value) => Number.isFinite(value) && value > 0;
  const lines = bet.systemLines;
  const potential =
    bet.betType === 'multiple' || lines?.length
      ? lines?.length && lines.every((line) => validAmount(line.stake) && validAmount(line.odds))
        ? lines.reduce((sum, line) => sum + line.stake * line.odds, 0)
        : null
      : validAmount(bet.odds)
        ? bet.stake * bet.odds
        : null;
  return {
    pending,
    returned,
    net: returned == null ? null : returned - bet.stake,
    potential: validAmount(bet.stake) && Number.isFinite(potential) ? potential : null
  };
}
export function historyReport(bets, filters = {}, now = Date.now()) {
  const period = bets.filter(
      (bet) =>
        filters.period === 'all' ||
        !filters.period ||
        new Date(bet.date).getTime() >= now - Number(filters.period) * 86400000
    ),
    query = (filters.search ?? '').trim().toLocaleLowerCase('fr');
  const visible = period.filter(
    (bet) =>
      (!filters.status ||
        filters.status === 'all' ||
        (filters.status === 'pending'
          ? bet.status === 'pending'
          : filters.status === 'settled'
            ? bet.status !== 'pending'
            : bet.status === filters.status)) &&
      (!query ||
        bet.items.some((item) =>
          [item.match, item.label, item.league].join(' ').toLocaleLowerCase('fr').includes(query)
        ))
  );
  const totals = period.reduce(
    (sum, bet) => {
      const a = ticketAmounts(bet);
      sum.staked += bet.stake;
      if (a.pending) {
        sum.engaged += bet.stake;
        sum.potential =
          a.potential == null || sum.potential == null ? null : sum.potential + a.potential;
      } else if (a.returned == null) sum.missing++;
      else {
        sum.returned += a.returned;
        sum.net += a.net;
      }
      return sum;
    },
    { staked: 0, engaged: 0, potential: 0, returned: 0, net: 0, missing: 0 }
  );
  return { visible, period, totals };
}
export function historyCard(bet, { results = [], live = {}, fixtures = [] } = {}) {
  const settlement = new Date(bet.settledAt ?? NaN);
  const settled =
    bet.status !== 'pending' && Number.isFinite(settlement.getTime())
      ? `<small>Réglé le <time datetime="${settlement.toISOString()}">${settlement.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' })}</time></small>`
      : '';
  const amounts = ticketAmounts(bet),
    selections = bet.items.map((item) => selectionResult(item, results)),
    done = selections.filter((leg) => leg.status !== 'pending').length,
    playing = bet.items.some((item) => live[item.matchId]?.state === 'in'),
    officialWaiting =
      amounts.pending && bet.certified && settleTicket(bet, results).status !== 'pending',
    status = amounts.pending
      ? officialWaiting
        ? '◷ Règlement officiel en cours'
        : playing
          ? '● En cours'
          : done
            ? '◷ Partiellement réglé'
            : '◷ En attente'
      : (labels[bet.status] ?? 'Résultat indisponible'),
    kind =
      bet.betType === 'multiple'
        ? `Système ${bet.systemFormula ?? ''}`
        : bet.items.length > 1
          ? 'Combiné'
          : 'Pari simple';
  const legs = bet.items
    .map((item, index) => {
      const { status, result } = selections[index],
        current = live[item.matchId]?.state === 'in' ? live[item.matchId] : null,
        fixture = fixtures.find((match) => match.id === item.matchId),
        date = item.date ?? fixture?.date,
        text =
          status === 'pending'
            ? !amounts.pending
              ? 'Résultat de la sélection indisponible'
              : current
                ? '● En direct'
                : '◷ En attente du résultat'
            : labels[status],
        score =
          status === 'void'
            ? 'Match annulé'
            : marketSpec(item.key)?.period === 'h1'
              ? result?.periodScores?.h1
                ? `Score à la mi-temps : ${result.periodScores.h1.home} : ${result.periodScores.h1.away}`
                : amounts.pending
                  ? 'Score de mi-temps en attente de vérification'
                  : 'Score de mi-temps indisponible'
              : result?.completed
                ? `Score final : ${result.homeScore} : ${result.awayScore}`
                : current
                  ? `Direct ${current.clock} : ${current.home} : ${current.away}`
                  : 'Score indisponible';
      return `<li class="personal-leg ${status}"><div><strong>${escape(item.match)}</strong><small>${escape([item.league ?? fixture?.league, date, item.time ?? fixture?.time].filter(Boolean).join(' · ') || 'Horaire indisponible')}</small><p>Pronostic : <b>${escape(item.label)}</b> · cote ${decimal(Number(item.odd), 2)}</p>${item.sourceNickname ? `<small class="copied-bet">Pari copié de ${escape(item.sourceNickname)}</small>` : ''}</div><div><span class="status ${status}">${text}</span><small>${escape(score)}</small></div></li>`;
    })
    .join('');
  const lines = bet.systemLines
    ?.map(
      (line, index) =>
        `<li>Sous-pari ${index + 1} : sélections ${line.indexes.map((i) => i + 1).join(' + ')} · mise ${money(line.stake)} · cote ${decimal(Number(line.odds), 2)}</li>`
    )
    .join('');
  const displayAmount = (value) => (value == null ? 'Indisponible' : money(value));
  const potentialNet = amounts.potential == null ? null : amounts.potential - bet.stake;
  const progress =
    bet.items.length > 1
      ? `<p class="ticket-progress">${done} / ${bet.items.length} sélections réglées${bet.betType === 'multiple' ? ' · Les sous-paris gagnants peuvent rapporter un retour partiel.' : selections.some((leg) => leg.status === 'lost') ? ' · Une sélection perdante rend ce combiné perdant.' : ' · Toutes les sélections doivent gagner ; une annulation ramène sa cote à 1.'}</p>`
      : '';
  return `<article class="personal-ticket ${escape(bet.status)}"><header><div><small>${escape(new Date(bet.date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }))}${bet.certified ? ' · Certifié' : bet.legacy ? ' · Avant saison 1' : ''}</small><h3>${escape(kind)} <span>· ${bet.items.length} sélection${bet.items.length > 1 ? 's' : ''}</span></h3>${settled}</div><span class="status ${escape(bet.status)}">${status}</span></header><dl class="ticket-figures"><div><dt>${bet.betType === 'multiple' ? 'Cotes par sous-pari' : 'Cote totale'}</dt><dd>${bet.betType === 'multiple' ? 'Voir le détail' : new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(bet.odds)}${bet.items.length > 1 && bet.betType !== 'multiple' ? '<small>Ticket complet</small>' : ''}</dd></div><div><dt>Mise totale</dt><dd>${money(bet.stake)}</dd></div><div><dt>${amounts.pending ? 'Retour potentiel' : 'Retour réel'}</dt><dd>${displayAmount(amounts.pending ? amounts.potential : amounts.returned)}<small>Mise incluse</small></dd></div><div><dt>${amounts.pending ? 'Bénéfice potentiel' : 'Résultat net'}</dt><dd>${displayAmount(amounts.pending ? potentialNet : amounts.net)}<small>${amounts.pending ? 'Non acquis' : 'Retour moins mise'}</small></dd></div></dl>${bet.id ? `<button type="button" class="button secondary" data-share-ticket="${escape(bet.id)}">Partager ce ticket</button>` : ''}${progress}<ol class="personal-legs">${legs}</ol>${lines ? `<details class="system-details" data-bet-detail="${escape(bet.id ?? bet.date)}"><summary>Détail des sous-paris</summary><ol class="system-breakdown">${lines}</ol></details>` : ''}</article>`;
}
