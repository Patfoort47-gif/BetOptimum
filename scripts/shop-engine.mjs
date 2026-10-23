// Boutique et duels (BET-62) : catalogue et objet de la semaine envoyés à Supabase, duels réglés après le défi du jour.
// Décisions pures dans shop.js ; ce fichier écrit avec la clé service_role (jetons : journal token_ledger, jamais d'écriture depuis le navigateur).
import { CATALOG, PACKS, duelWinner, packPrice, weeklyItem } from '../shop.js';
import { parisDate, weekKey } from '../model.js';

// Lignes de shop_items : objets du catalogue puis packs stade (prix recalculé à 80 % des éléments).
export function shopRows(catalog = CATALOG, packs = PACKS) {
  const rows = catalog.map(entry => ({ id: entry.id, category: entry.category, name: entry.name, rarity: entry.rarity, price: entry.price, exclusive: Boolean(entry.exclusive), min_division: entry.minDivision ?? null, collection: entry.collection ?? null, asset: entry.asset ?? null, pack_of: null }));
  for (const pack of packs) rows.push({ id: pack.id, category: 'pack', name: pack.name, rarity: 'rare', price: packPrice(pack.components, catalog), exclusive: false, min_division: null, collection: null, asset: null, pack_of: pack.components });
  return rows;
}
export async function syncShop(admin, now = new Date()) {
  const rows = shopRows();
  await admin.upsert('shop_items', rows, 'id');
  await admin.upsert('shop_weekly', [{ week: weekKey(now), item_id: weeklyItem(CATALOG, weekKey(now)) }], 'week');
  return rows.length;
}

// Duels à régler : un duel en attente d'un jour passé expire (mise remboursée), un duel accepté d'un jour passé est réglé sur les points du défi du jour de chacun.
// picks : [{user_id, day, points, status}] ; today : AAAA-MM-JJ (Paris). Les pronos encore en attente repoussent le règlement jusqu'à deux jours après.
export function planDuelSettlements(duels, picks, today) {
  const plan = [], dayMs = 864e5, age = day => Math.round((Date.parse(today) - Date.parse(day)) / dayMs);
  for (const duel of duels) {
    if (!['pending', 'accepted'].includes(duel.status) || age(duel.day) < 1) continue;
    if (duel.status === 'pending') { plan.push({ id: duel.id, winner: null }); continue; }
    const mine = user => picks.filter(pick => pick.user_id === user && pick.day === duel.day);
    if ((mine(duel.creator_id).concat(mine(duel.opponent_id))).some(pick => pick.status === 'pending') && age(duel.day) < 3) continue;
    const total = user => { const own = mine(user).filter(pick => pick.status !== 'pending'); return { picks: own.length, points: own.reduce((sum, pick) => sum + Number(pick.points), 0) }; };
    const result = duelWinner(total(duel.creator_id), total(duel.opponent_id));
    plan.push({ id: duel.id, winner: result === 'creator' ? duel.creator_id : result === 'opponent' ? duel.opponent_id : null });
  }
  return plan;
}
export async function settleDuels(admin, now = new Date()) {
  const today = parisDate(now), duels = await admin.selectAll('duels', 'status=in.(pending,accepted)&select=id,day,creator_id,opponent_id,status');
  if (!duels.length) return 0;
  const days = [...new Set(duels.map(duel => duel.day))], picks = await admin.selectAll('daily_picks', `day=in.(${days.join(',')})&select=user_id,day,points,status`);
  let settled = 0;
  for (const decision of planDuelSettlements(duels, picks, today)) if (await admin.rpc('settle_duel', { p_duel: decision.id, p_winner: decision.winner })) settled++;
  return settled;
}
