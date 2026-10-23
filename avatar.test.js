import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from './avatar-config.js';
import { CATALOG } from './shop.js';

const UID = '0b8f6c52-1d3a-4f5e-9a7b-2c4d6e8f0a1b';

test('l’avatar par défaut est valide et n’utilise que des options gratuites', () => {
  const config = A.defaultAvatar();
  assert.deepEqual(A.validateAvatar(config), []);
  assert.deepEqual(A.restrictedIds(config), []);
  assert.deepEqual(A.sanitizeAvatar(config), config);
});

test('la validation renvoie toujours une configuration utilisable, même pour des données piégées', () => {
  for (const raw of [null, undefined, 42, 'x', [], { v: 2, skin: 99, hair: -1, kit: 'x', accessories: 'no', showcase: [1, 2], background: '<script>' }, { v: 9 }, { v: 2, kit: { item: 'kit-pirate', number: 500, name: '<img onerror=1>' } }]) {
    const clean = A.sanitizeAvatar(raw);
    assert.deepEqual(A.validateAvatar(clean), [], JSON.stringify(raw));
    assert.equal(clean.v, 2);
  }
  const hostile = A.sanitizeAvatar({ v: 2, kit: { item: 'start-lime', number: 7, name: '<img src=x onerror=alert(1)>' } });
  assert.match(hostile.kit.name, /^[A-Z0-9 .-]*$/);
  assert.ok(hostile.kit.name.length <= A.MAX_NAME);
});

test('la validation stricte refuse ce que la remise en forme corrigerait', () => {
  const config = A.defaultAvatar();
  assert.ok(A.validateAvatar({ ...config, skin: 9 }).length);
  assert.ok(A.validateAvatar({ ...config, hair: 1.5 }).length);
  assert.ok(A.validateAvatar({ ...config, pose: 'flying' }).length);
  assert.ok(A.validateAvatar({ ...config, kit: { item: 'kit-inconnu', number: 1, name: '' } }).length);
  assert.ok(A.validateAvatar({ ...config, accessories: ['acc-cap', 'acc-crown'] }).length, 'deux accessoires sur la même zone');
  assert.ok(A.validateAvatar({ ...config, showcase: ['trophy-cup', 'trophy-cup'] }).length);
  assert.ok(A.validateAvatar({ ...config, extra: 'x'.repeat(2000) }).length, 'trop volumineux');
  assert.deepEqual(A.validateAvatar({ avatar: 'blue', face: 'cool', accessory: 'none' }), [], 'ancien avatar accepté');
  assert.ok(A.validateAvatar({ avatar: 'pink', face: 'cool', accessory: 'none' }).length);
});

test('un seul accessoire par zone et cinq au plus', () => {
  assert.deepEqual(A.cleanAccessories(['acc-cap', 'acc-crown', 'acc-glasses', 'acc-cap']), ['acc-cap', 'acc-glasses']);
  assert.equal(A.cleanAccessories(A.ACCESSORIES.map(entry => entry[0])).length, 5);
  assert.deepEqual(A.cleanAccessories('x'), []);
});

test('les anciens avatars sont convertis sans perte, la couronne seulement pour un Master', () => {
  const migrated = A.migrateAvatar({ avatar: 'purple', face: 'cool', accessory: 'glasses' });
  assert.equal(migrated.kit.item, 'start-purple');
  assert.equal(migrated.expression, 'confident');
  assert.deepEqual(migrated.accessories, ['acc-glasses']);
  assert.deepEqual(A.migrateAvatar({ avatar: 'lime', face: 'wink', accessory: 'crown' }).accessories, []);
  assert.deepEqual(A.migrateAvatar({ avatar: 'lime', face: 'wink', accessory: 'crown' }, { master: true }).accessories, ['acc-crown']);
  assert.deepEqual(A.sanitizeAvatar({ avatar: 'orange', face: 'focused', accessory: 'cap' }).kit.item, 'start-orange');
  // aller-retour : la vue simplifiée retrouve l'avatar d'origine
  for (const old of [{ avatar: 'blue', face: 'smile', accessory: 'none' }, { avatar: 'orange', face: 'wink', accessory: 'cap' }, { avatar: 'purple', face: 'focused', accessory: 'glasses' }]) assert.deepEqual(A.legacyView(A.migrateAvatar(old)), old);
});

test('chaque objet d’avatar de la boutique a son rendu, et chaque option payante existe en boutique', () => {
  const byCategory = category => CATALOG.filter(entry => entry.category === category).map(entry => entry.id);
  for (const id of byCategory('kit')) assert.ok(A.KITS[id], `maillot sans rendu : ${id}`);
  for (const id of byCategory('accessory')) assert.ok(A.ACCESSORIES.some(entry => entry[0] === id), `accessoire sans rendu : ${id}`);
  for (const id of byCategory('trophy')) assert.ok(A.TROPHIES.some(entry => entry[0] === id), `trophée sans rendu : ${id}`);
  for (const id of byCategory('celebration')) assert.ok(A.CELEBRATIONS.some(entry => entry[0] === id), `célébration sans rendu : ${id}`);
  for (const id of byCategory('background')) assert.ok(A.SCENES.some(entry => entry[0] === id), `fond sans rendu : ${id}`);
  for (const id of byCategory('base')) assert.ok(A.BASES.some(entry => entry[0] === id), `socle sans rendu : ${id}`);
  const known = new Set([...CATALOG.map(entry => entry.id), ...Object.values(A.UNLOCK_IDS)]);
  const paid = [...Object.keys(A.KITS).filter(id => !A.KITS[id].free), ...A.ACCESSORIES.map(e => e[0]), ...A.TROPHIES.map(e => e[0]), ...A.CELEBRATIONS.map(e => e[0]).filter(id => !A.FREE_CELEBRATIONS.includes(id)), ...A.SCENES.map(e => e[0]), ...A.BASES.map(e => e[0]).filter(id => !A.FREE_BASES.includes(id))];
  for (const id of paid) assert.ok(known.has(id), `option sans objet de boutique ni déblocage : ${id}`);
});

test('les éléments débloqués par division correspondent à league.js', async () => {
  const { DIVISION_UNLOCKS } = await import('./league.js');
  assert.deepEqual(Object.keys(A.UNLOCK_IDS).sort(), Object.values(DIVISION_UNLOCKS).flat().sort());
});

test('l’essayage reste local : l’enregistrement ne garde que ce que le joueur possède', () => {
  const config = A.sanitizeAvatar({ ...A.defaultAvatar(), kit: { item: 'kit-stripe-band', number: 9, name: 'ALEX' }, accessories: ['acc-cap', 'acc-glasses'], base: 'base-gold', background: 'bg-rio-in', showcase: ['trophy-cup', 'trophy-ball'], celebration: 'celeb-flip', hairColor: A.LIME_HAIR });
  assert.deepEqual(A.restrictedIds(config).sort(), ['acc-cap', 'acc-glasses', 'base-gold', 'bg-rio-in', 'celeb-flip', 'hair-lime', 'kit-stripe-band', 'trophy-ball', 'trophy-cup'].sort());
  const owned = A.ownedIds(['acc-cap', 'trophy-cup', 'bg-rio-in'], ['cheveux vert citron']);
  const { config: kept, dropped } = A.stripUnowned(config, owned);
  assert.deepEqual(kept.accessories, ['acc-cap']);
  assert.equal(kept.kit.item, 'start-lime');
  assert.equal(kept.kit.name, 'ALEX', 'le nom et le numéro sont libres');
  assert.equal(kept.base, 'base-classic');
  assert.equal(kept.background, 'bg-rio-in');
  assert.deepEqual(kept.showcase, ['trophy-cup']);
  assert.equal(kept.celebration, 'celeb-jump');
  assert.equal(kept.hairColor, A.LIME_HAIR);
  assert.deepEqual(dropped.sort(), ['acc-glasses', 'base-gold', 'celeb-flip', 'kit-stripe-band', 'trophy-ball']);
  assert.deepEqual(A.restrictedIds(kept).filter(id => !owned.has(id)), []);
});

test('verrous : prix en jetons, division requise, objet exclusif', () => {
  const owned = new Set(['acc-cap']);
  assert.equal(A.lockOf('acc-cap', owned), null);
  assert.equal(A.lockOf('start-blue', owned), null, 'les maillots de départ ne sont pas dans le catalogue');
  assert.deepEqual(A.lockOf('acc-glasses', owned), { kind: 'shop', price: 600, name: 'Lunettes' });
  assert.equal(A.lockOf('acc-crown', owned).kind, 'division');
  assert.match(A.lockOf('base-silver', owned).label, /National/);
  assert.equal(A.lockOf('kit-champion', owned).kind, 'exclusive');
  assert.equal(A.lockOf(null, owned), null);
  assert.ok(A.isFreeOption('solid-3') && A.isFreeOption('base-classic') && A.isFreeOption('start-orange') && !A.isFreeOption('base-gold'));
});

test('adresse de l’image de l’avatar : refuse les identifiants et les hôtes suspects', () => {
  assert.equal(A.avatarImageUrl('https://abc.supabase.co/', UID, 5), `https://abc.supabase.co/storage/v1/object/public/avatars/${UID}/bust?v=5`);
  assert.match(A.avatarImageUrl('https://abc.supabase.co', UID, 5, 'full'), /\/full\?v=5$/);
  assert.equal(A.avatarImageUrl('https://abc.supabase.co', UID, 0), null, 'pas encore d’image');
  assert.equal(A.avatarImageUrl('https://abc.supabase.co', '../../x', 5), null);
  assert.equal(A.avatarImageUrl('javascript:alert(1)//', UID, 5), null);
  assert.equal(A.avatarImageUrl('http://abc.supabase.co', UID, 5), null);
});

test('niveau de qualité : haut sur ordinateur, moyen sur téléphone, bas en économie de données', () => {
  assert.equal(A.qualityFor({ coarse: false, memory: 16, cores: 12 }), 'high');
  assert.equal(A.qualityFor({ coarse: true, memory: 8, cores: 8 }), 'mid');
  assert.equal(A.qualityFor({ memory: 2, cores: 8 }), 'mid');
  assert.equal(A.qualityFor({ saveData: true }), 'low');
  assert.ok(A.QUALITY.high.shadow > A.QUALITY.mid.shadow && A.QUALITY.mid.shadow > A.QUALITY.low.shadow);
});

test('les options de l’interface ont toutes un identifiant unique', () => {
  for (const list of [A.SKINS, A.FACES, A.EYES, A.EXPRESSIONS, A.HAIRS, A.HAIR_COLORS, A.BOOTS, A.POSES, A.ACCESSORIES, A.TROPHIES, A.BASES, A.CELEBRATIONS, A.SCENES, A.SOLID_BACKGROUNDS]) assert.equal(new Set(list.map(entry => entry[0])).size, list.length);
  assert.equal(A.HAIRS.length, 12);
  assert.equal(A.SKINS.length, 5);
  assert.equal(A.FACES.length, 6);
  assert.equal(A.SOLID_BACKGROUNDS.length, 6);
});

test('mettre ou retirer un objet de la boutique remplace l’emplacement et reste valide', () => {
  let config = A.defaultAvatar();
  config = A.applyItem(config, 'acc-cap'); config = A.applyItem(config, 'acc-headband');
  assert.deepEqual(config.accessories, ['acc-headband'], 'une seule pièce sur la tête');
  config = A.applyItem(config, 'acc-glasses'); assert.deepEqual(config.accessories.sort(), ['acc-glasses', 'acc-headband']);
  for (const id of ['trophy-cup', 'trophy-ball', 'trophy-boot', 'trophy-glove']) config = A.applyItem(config, id);
  assert.deepEqual(config.showcase, ['trophy-ball', 'trophy-boot', 'trophy-glove'], 'trois trophées au plus, le plus ancien sort');
  config = A.applyItem(config, 'kit-retro-90'); config = A.applyItem(config, 'bg-rio-in'); config = A.applyItem(config, 'base-neon'); config = A.applyItem(config, 'celeb-slide');
  assert.equal(config.kit.item, 'kit-retro-90'); assert.equal(config.background, 'bg-rio-in'); assert.equal(config.base, 'base-neon'); assert.equal(config.celebration, 'celeb-slide');
  assert.deepEqual(A.validateAvatar(config), []);
  assert.equal(A.applyItem(config, 'inconnu').kit.item, 'kit-retro-90', 'identifiant inconnu : sans effet');
  config = A.removeItem(A.removeItem(config, 'kit-retro-90'), 'bg-rio-in');
  assert.equal(config.kit.item, 'start-lime'); assert.equal(config.background, 'solid-1');
  assert.deepEqual(A.removeItem(A.applyItem(A.defaultAvatar(), 'trophy-cup'), 'trophy-cup').showcase, []);
  assert.ok(A.isWorn(A.applyItem(A.defaultAvatar(), 'acc-scarf'), 'acc-scarf'));
  assert.deepEqual(A.unownedIds(A.applyItem(A.defaultAvatar(), 'acc-scarf'), new Set()), ['acc-scarf']);
  assert.deepEqual(A.AVATAR_CATEGORIES.sort(), ['accessory', 'background', 'base', 'celebration', 'kit', 'trophy']);
});
