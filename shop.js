// Boutique et usages des jetons (BET-62) : catalogue, raretés, vitrine du jour, packs, revente. Fonctions pures, sans DOM ni réseau.
// Les jetons n'ont aucune valeur : ils ne s'achètent pas, ne s'échangent pas, ne se convertissent pas. Noms génériques (aucune marque) en attendant l'avis juridique (BET-63).
export const RARITIES = { common: { label: 'Commun', min: 300, max: 800 }, rare: { label: 'Rare', min: 1500, max: 3000 }, epic: { label: 'Épique', min: 5000, max: 20000 }, legendary: { label: 'Légendaire', min: 25000, max: 50000 }, exclusive: { label: 'Exclusif', min: 0, max: 0 } };
export const CATEGORIES = { kit: 'Maillots', accessory: 'Accessoires', trophy: 'Trophées', background: 'Fonds et stades', base: 'Socles', frame: 'Cadres de carte', celebration: 'Célébrations', title: 'Titres' };
export const WEEKLY_DISCOUNT = .3, PACK_DISCOUNT = .2, RESALE_SHARE = .3, SHOWCASE_SIZE = 8;
// Seuls le titre et le cadre de carte s'affichent aujourd'hui ; le reste s'affichera sur l'avatar 3D dès sa livraison (BET-47 et BET-49).
export const DISPLAYABLE = ['title', 'frame'];

const item = (id, category, name, rarity, price, extra = {}) => ({ id, category, name, rarity, price, ...extra });
const kits = [['lime', 'Lime'], ['blue', 'Bleu'], ['red', 'Rouge'], ['white', 'Blanc'], ['black', 'Noir'], ['orange', 'Orange']].map(([key, label], index) => item(`kit-plain-${key}`, 'kit', `Maillot uni ${label}`, 'common', 400 + (index % 3) * 150));
const stripes = [['vertical', 'rayures verticales'], ['band', 'bande'], ['hoops', 'rayures horizontales'], ['scarf', 'écharpe']].map(([key, label], index) => item(`kit-stripe-${key}`, 'kit', `Maillot ${label}`, 'common', 600 + index * 50, { collection: 'maillots-motifs' }));
const retro = [['retro-70', 'Rétro années 70'], ['retro-90', 'Rétro années 90'], ['retro-champion', 'Rétro de légende']].map(([key, label], index) => item(`kit-${key}`, 'kit', `Maillot ${label}`, 'rare', 1800 + index * 400));
const accessories = [['captain', 'Brassard de capitaine', 300], ['cap', 'Casquette', 400], ['headband', 'Bandeau', 400], ['glasses', 'Lunettes', 600], ['headphones', 'Casque audio', 800], ['scarf', 'Écharpe de supporter', 500]].map(([key, name, price]) => item(`acc-${key}`, 'accessory', name, 'common', price, { collection: 'tribune' }));
// Noms des récompenses du football, choisis par Matteo le 22 octobre 2026 ; « Ballon d'or », « Soulier d'or » et « Pichichi » sont des marques ou des noms protégés : à valider avant la mise en production (VALIDATION_JURIDIQUE.md, question 3).
const trophies = [item('trophy-ball', 'trophy', 'Ballon d’or', 'legendary', 50000), item('trophy-boot', 'trophy', 'Soulier d’or', 'epic', 20000), item('trophy-glove', 'trophy', 'Gant d’or', 'legendary', 25000), item('trophy-pichichi', 'trophy', 'Pichichi', 'epic', 12000), item('trophy-cup', 'trophy', 'Coupe des champions', 'epic', 5000)];
const stadiums = [['rio', 'Rio'], ['barcelona', 'Barcelone'], ['madrid', 'Madrid'], ['paris', 'Paris'], ['munich', 'Munich'], ['london', 'Londres']];
const stadiumItems = stadiums.flatMap(([key, label], index) => [item(`bg-${key}-in`, 'background', `Stade de ${label}, vu de l'intérieur`, 'rare', 2200 + index * 100, { collection: `stade-${key}` }), item(`bg-${key}-out`, 'background', `Stade de ${label}, vu de l'extérieur`, 'rare', 2200 + index * 100, { collection: `stade-${key}` })]);
const simpleBackgrounds = [item('bg-training', 'background', 'Centre d’entraînement', 'common', 800), item('bg-lockers', 'background', 'Vestiaire', 'common', 700), item('bg-tunnel', 'background', 'Tunnel des joueurs', 'rare', 1500)];
const bases = [item('base-grass', 'base', 'Socle gazon', 'common', 500), item('base-neon', 'base', 'Socle néon', 'rare', 2000), item('base-gold', 'base', 'Socle or', 'epic', 6000)];
const frames = [item('frame-bronze', 'frame', 'Cadre bronze', 'common', 500, { asset: 'bronze' }), item('frame-silver', 'frame', 'Cadre argent', 'rare', 1500, { asset: 'silver' }), item('frame-neon', 'frame', 'Cadre néon', 'rare', 2200, { asset: 'neon' }), item('frame-gold', 'frame', 'Cadre or', 'epic', 6000, { asset: 'gold' })];
const celebrations = [item('celeb-fist', 'celebration', 'Poing levé', 'common', 600), item('celeb-slide', 'celebration', 'Glissade à genoux', 'rare', 1800), item('celeb-flip', 'celebration', 'Salto', 'rare', 2200)];
const titles = [item('title-strategist', 'title', 'Le Stratège', 'common', 300, { asset: 'Le Stratège' }), item('title-lynx', 'title', 'Œil de lynx', 'rare', 1500, { asset: 'Œil de lynx' }), item('title-cool', 'title', 'Sang-froid', 'rare', 2000, { asset: 'Sang-froid' }), item('title-legend', 'title', 'Légende vivante', 'epic', 8000, { asset: 'Légende vivante' })];
const exclusives = [item('acc-crown', 'accessory', 'Couronne du Master', 'exclusive', 0, { exclusive: true }), item('kit-champion', 'kit', 'Maillot de champion', 'exclusive', 0, { exclusive: true })];
export const CATALOG = [...kits, ...stripes, ...retro, ...accessories, ...trophies, ...stadiumItems, ...simpleBackgrounds, ...bases, ...frames, ...celebrations, ...titles, ...exclusives];
// Packs stade : stade (intérieur et extérieur), maillot uni et écharpe, moins cher que les éléments séparés.
export const PACKS = stadiums.map(([key, label]) => ({ id: `pack-${key}`, name: `Pack stade de ${label}`, components: [`bg-${key}-in`, `bg-${key}-out`, 'kit-plain-lime', 'acc-scarf'] }));

export const purchasable = catalog => catalog.filter(entry => !entry.exclusive && entry.price > 0);
export const validPrice = entry => entry.exclusive ? entry.price === 0 : entry.price >= RARITIES[entry.rarity].min && entry.price <= RARITIES[entry.rarity].max;
export const resalePrice = paid => Math.floor(Number(paid) * RESALE_SHARE);
export const packPrice = (components, catalog = CATALOG) => Math.round(components.reduce((sum, id) => sum + (catalog.find(entry => entry.id === id)?.price ?? 0), 0) * (1 - PACK_DISCOUNT));
// Générateur pseudo-aléatoire reproductible : la vitrine est la même pour tous les joueurs, renouvelée chaque jour à minuit (Paris).
function seeded(text) { let h = 1779033703 ^ text.length; for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
export function dailyShowcase(catalog, day, size = SHOWCASE_SIZE) {
  const random = seeded(`showcase:${day}`), pool = purchasable(catalog).filter(entry => entry.rarity !== 'legendary' || random() < .35).sort((a, b) => a.id.localeCompare(b.id));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, size).map(entry => entry.id);
}
// Objet de la semaine à -30 % (clé : lundi de la semaine de Paris), rare ou mieux pour que la remise compte.
export function weeklyItem(catalog, week) {
  const pool = purchasable(catalog).filter(entry => entry.price >= 1500).sort((a, b) => a.id.localeCompare(b.id)), random = seeded(`weekly:${week}`);
  return pool[Math.floor(random() * pool.length)].id;
}
export const priceFor = (entry, weeklyId) => entry.id === weeklyId ? Math.round(entry.price * (1 - WEEKLY_DISCOUNT)) : entry.price;
// Collections complètes (au moins deux objets) parmi les objets possédés : un badge s'obtient quand l'une est complète.
export function completedCollections(catalog, owned) {
  const groups = new Map();
  for (const entry of catalog) if (entry.collection) groups.set(entry.collection, [...(groups.get(entry.collection) ?? []), entry.id]);
  const have = new Set(owned);
  return [...groups].filter(([, ids]) => ids.length >= 2 && ids.every(id => have.has(id))).map(([name]) => name);
}
// Conditions d'achat avant d'appeler le serveur (le serveur applique les mêmes règles) : renvoie null si l'achat est possible, sinon le motif.
export function purchaseBlock(entry, { balance, owned = [], division = null, weeklyId = null }) {
  if (entry.exclusive) return 'EXCLUSIF';
  if (owned.includes(entry.id)) return 'POSSEDE';
  if (entry.minDivision != null && (division ?? -1) < entry.minDivision) return 'DIVISION';
  return balance < priceFor(entry, weeklyId) ? 'SOLDE' : null;
}
// Autres usages des jetons : bouclier de série (une fois par saison et par ligue), recharge de bankroll (sous 50 €), mises d'un duel.
export const SHIELD_PRICE = 800, REFILL = { price: 500, amount: 1000, below: 50 }, DUEL = { min: 50, max: 5000 };
export const canRefill = (bankroll, balance) => Number(bankroll) < REFILL.below && balance >= REFILL.price;
export const validDuelStake = stake => Number.isInteger(stake) && stake >= DUEL.min && stake <= DUEL.max;
// Résultat d'un duel sur le défi du jour : points cumulés du jour de chaque joueur ; égalité ou aucun prono des deux côtés : mises remboursées.
export function duelWinner(creator, opponent) {
  if (creator.picks === 0 && opponent.picks === 0) return null;
  if (creator.picks === 0) return 'opponent';
  if (opponent.picks === 0) return 'creator';
  return creator.points > opponent.points ? 'creator' : opponent.points > creator.points ? 'opponent' : null;
}
