// Studio d'avatar 3D (BET-49) : aperçu en direct, options par catégorie, options verrouillées avec leur condition, essayage avant achat, enregistrement.
// Chargé à la demande (page profil, inscription) : Three.js n'est téléchargé qu'à l'ouverture du studio.
import { ACCESSORIES, BASES, BODIES, BOOTS, CELEBRATIONS, EXPRESSIONS, EYES, FACES, HAIRS, HAIR_COLORS, KITS, LIME_HAIR, MAX_NAME, MAX_SHOWCASE, POSES, SCENES, SKINS, SOLID_BACKGROUNDS, START_KITS, TROPHIES, UNLOCK_LABELS, lockOf, ownedIds, sanitizeAvatar, stripUnowned, unownedIds } from './avatar-config.js';
import { CATALOG } from './shop.js';
import { backgroundSwatch, kitSwatch } from './avatar-scenes.js';
import { avatarMarkup } from './avatar-view.js';

const ALL_TABS = [['face', 'Visage'], ['hair', 'Coiffure'], ['kit', 'Tenue'], ['pose', 'Pose'], ['acc', 'Accessoires'], ['base', 'Socle'], ['bg', 'Fond'], ['showcase', 'Vitrine']];
const nameOf = id => CATALOG.find(entry => entry.id === id)?.name ?? KITS[id]?.name ?? ACCESSORIES.find(entry => entry[0] === id)?.[1] ?? BASES.find(entry => entry[0] === id)?.[1] ?? ({ 'hair-lime': 'Cheveux vert citron' })[id] ?? id;
const KIT_IDS = [...new Set([...START_KITS, ...CATALOG.filter(entry => entry.category === 'kit').map(entry => entry.id), 'kit-gold'])];
const swatches = new Map();
const swatch = (kind, id) => { const key = `${kind}:${id}`; if (!swatches.has(key)) swatches.set(key, kind === 'kit' ? kitSwatch(id, 72) : backgroundSwatch(id, 96)); return swatches.get(key); };

// options : { html, toast, getSaved, loadContext, save, openShop, openJoin, authenticated, tabs, freeOnly, initial }
export async function mountStudio(root, options) {
  const { html, toast } = options, tabs = ALL_TABS.filter(([id]) => !options.tabs || options.tabs.includes(id));
  let saved = sanitizeAvatar(options.initial ?? options.getSaved?.()), draft = saved, owned = new Set(), tab = tabs[0][0], stage = null, busy = false, off = false, destroyed = false, view = 'full';
  const clone = value => JSON.parse(JSON.stringify(value));
  root.innerHTML = `<div class="studio${options.stacked ? ' stacked' : ''}"><div class="studio-stage"><div class="studio-canvas" data-host aria-live="polite"><p class="studio-loading">Préparation du studio 3D…</p></div><div class="studio-tools"><button type="button" class="button secondary" data-act="celebrate">Célébrer</button><button type="button" class="button secondary" data-act="view" aria-pressed="false">Buste</button><button type="button" class="button secondary" data-act="reset">Recentrer</button></div><p class="studio-hint">Glissez pour faire tourner votre joueur, molette ou pincement pour zoomer.</p></div><div class="studio-panel"><div class="studio-tabs" role="tablist" aria-label="Catégories">${tabs.map(([id, label]) => `<button type="button" role="tab" id="stab-${id}" data-stab="${id}">${label}</button>`).join('')}</div><div class="studio-banner" data-banner hidden></div><div class="studio-options" role="tabpanel" data-options></div>${options.hideActions ? '' : `<div class="studio-actions"><button type="button" class="button secondary" data-act="cancel" disabled>Annuler</button><button type="button" class="button primary" data-act="save" disabled>${options.saveLabel ?? 'Enregistrer'}</button></div>`}</div></div>`;
  const $ = selector => root.querySelector(selector), host = $('[data-host]'), panel = $('[data-options]'), banner = $('[data-banner]');

  const lockTag = id => { const lock = lockOf(id, owned); if (!lock) return ''; return `<small class="lock-tag lock-${lock.kind}">${lock.kind === 'shop' ? `<i class="coin" aria-hidden="true"></i>${Number(lock.price).toLocaleString('fr-FR')}` : html(lock.label)}</small>`; };
  const hidden = id => options.freeOnly && lockOf(id, owned);
  const chip = (label, active, data, extra = '') => `<button type="button" class="opt${active ? ' on' : ''}" aria-pressed="${active}" ${data}>${html(label)}${extra}</button>`;
  const dot = (color, label, active, data, extra = '') => `<button type="button" class="opt dot${active ? ' on' : ''}" aria-pressed="${active}" aria-label="${html(label)}" title="${html(label)}" style="--c:${color}" ${data}>${extra}</button>`;
  const group = (title, body) => `<fieldset class="opt-group"><legend>${title}</legend><div class="opt-row">${body}</div></fieldset>`;
  const card = (id, label, active, data, image, extra = '') => `<button type="button" class="opt card${active ? ' on' : ''}" aria-pressed="${active}" ${data}><img src="${image}" alt="" width="72" height="72" loading="lazy"><span>${html(label)}</span>${extra}</button>`;

  function panelHtml() {
    const d = draft;
    if (tab === 'face') return group('Silhouette', BODIES.map(([id, label]) => chip(label, d.body === id, `data-set="body" data-value="${id}"`)).join('')) + group('Teint', SKINS.map(([color, label], i) => dot(color, label, d.skin === i, `data-set="skin" data-value="${i}"`)).join('')) + group('Forme du visage', FACES.map(([, label], i) => chip(label, d.face === i, `data-set="face" data-value="${i}"`)).join('')) + group('Yeux', EYES.map(([color, label], i) => dot(color, label, d.eyes === i, `data-set="eyes" data-value="${i}"`)).join('')) + group('Expression', EXPRESSIONS.map(([id, label]) => chip(label, d.expression === id, `data-set="expression" data-value="${id}"`)).join(''));
    if (tab === 'hair') return group('Coiffure', HAIRS.map(([, label], i) => chip(label, d.hair === i, `data-set="hair" data-value="${i}"`)).join('')) + group('Couleur', HAIR_COLORS.map(([color, label], i) => i === LIME_HAIR && hidden('hair-lime') ? '' : dot(color, label, d.hairColor === i, `data-set="hairColor" data-value="${i}"`, i === LIME_HAIR ? lockTag('hair-lime') : '')).join(''));
    if (tab === 'kit') return group('Maillot', `<div class="opt-cards">${KIT_IDS.filter(id => !hidden(id)).map(id => card(id, nameOf(id), d.kit.item === id, `data-kit="${id}"`, swatch('kit', id), lockTag(id))).join('')}</div>`) + `<div class="opt-fields"><label>Numéro<input type="number" min="0" max="99" inputmode="numeric" data-field="number" value="${d.kit.number ?? ''}" placeholder="Aucun"></label><label>Nom au dos<input type="text" maxlength="${MAX_NAME}" data-field="name" value="${html(d.kit.name)}" placeholder="Votre nom" autocomplete="off" style="text-transform:uppercase"></label></div>` + group('Crampons', BOOTS.map(([color, label], i) => dot(color, label, d.boots === i, `data-set="boots" data-value="${i}"`)).join(''));
    if (tab === 'pose') return group('Pose', POSES.map(([id, label]) => chip(label, d.pose === id, `data-set="pose" data-value="${id}"`)).join('')) + group('Célébration', CELEBRATIONS.filter(([id]) => !hidden(id)).map(([id, label]) => chip(label, d.celebration === id, `data-set="celebration" data-value="${id}"`, lockTag(id))).join('')) + '<p class="muted">Le bouton « Célébrer » joue la célébration choisie.</p>';
    if (tab === 'acc') return group('Accessoires', ACCESSORIES.filter(([id]) => !hidden(id)).map(([id, label]) => chip(label, d.accessories.includes(id), `data-acc="${id}"`, lockTag(id))).join('')) + '<p class="muted">Une pièce par zone : tête, visage, oreilles, cou, bras.</p>';
    if (tab === 'base') return group('Socle', BASES.filter(([id]) => !hidden(id)).map(([id, label]) => chip(label, d.base === id, `data-set="base" data-value="${id}"`, lockTag(id))).join(''));
    if (tab === 'bg') return group('Fonds unis', SOLID_BACKGROUNDS.map(([id, label, c1, c2]) => `<button type="button" class="opt dot big${d.background === id ? ' on' : ''}" aria-pressed="${d.background === id}" aria-label="${label}" title="${label}" style="--c:${c1};--c2:${c2}" data-set="background" data-value="${id}"></button>`).join('')) + group('Scènes', `<div class="opt-cards">${SCENES.filter(([id]) => !hidden(id)).map(([id, label]) => card(id, label, d.background === id, `data-set="background" data-value="${id}"`, swatch('bg', id), lockTag(id))).join('')}</div>`);
    return group(`Vitrine (${MAX_SHOWCASE} au plus)`, TROPHIES.filter(([id]) => !hidden(id)).map(([id, label]) => chip(label, d.showcase.includes(id), `data-trophy="${id}"`, lockTag(id))).join('')) + '<p class="muted">Les trophées se gagnent ou s’achètent en boutique, puis se posent devant votre joueur.</p>';
  }
  const keyOf = value => JSON.stringify({ ...value, rev: 0 });
  const dirty = () => keyOf(stripUnowned(draft, owned).config) !== keyOf(saved);
  function refresh(full = true) {
    if (full) {
      tabs.forEach(([id]) => { const el = $(`#stab-${id}`); el.setAttribute('aria-selected', String(id === tab)); el.tabIndex = id === tab ? 0 : -1; });
      panel.innerHTML = panelHtml();
    }
    const trying = unownedIds(draft, owned);
    banner.hidden = !trying.length; banner.innerHTML = trying.length ? `<b>Essayage</b> · ${trying.map(id => html(nameOf(id))).join(', ')}. Non enregistré tant que vous ne le possédez pas. ${options.openShop ? '<button type="button" class="link-button" data-act="shop">Ouvrir la boutique</button>' : ''}` : '';
    const saveButton = $('[data-act="save"]'), cancelButton = $('[data-act="cancel"]');
    if (saveButton) { saveButton.disabled = busy || off || !dirty(); cancelButton.disabled = busy || off || keyOf(draft) === keyOf(saved); }
    options.onChange?.(draft);
  }
  function update(mutate, full = true) { const next = clone(draft); mutate(next); draft = sanitizeAvatar(next); stage?.setLook(draft); refresh(full); }

  panel.addEventListener('click', event => {
    const target = event.target.closest('button'); if (!target || off) return;
    if (target.dataset.set) { const key = target.dataset.set, raw = target.dataset.value; update(v => { v[key] = ['body', 'expression', 'pose', 'base', 'background', 'celebration'].includes(key) ? raw : Number(raw); }); if (key === 'celebration') stage?.celebrate(raw); }
    else if (target.dataset.kit) update(v => { v.kit.item = target.dataset.kit; });
    else if (target.dataset.acc) update(v => { const id = target.dataset.acc; v.accessories = v.accessories.includes(id) ? v.accessories.filter(other => other !== id) : [...v.accessories.filter(other => ACCESSORIES.find(e => e[0] === other)[2] !== ACCESSORIES.find(e => e[0] === id)[2]), id]; });
    else if (target.dataset.trophy) update(v => { const id = target.dataset.trophy; v.showcase = v.showcase.includes(id) ? v.showcase.filter(other => other !== id) : [...v.showcase, id].slice(-MAX_SHOWCASE); });
  });
  panel.addEventListener('input', event => {
    const field = event.target.dataset.field; if (!field) return;
    if (field === 'number') update(v => { const n = event.target.value === '' ? null : Math.round(Number(event.target.value)); v.kit.number = Number.isFinite(n) && n >= 0 && n <= 99 ? n : null; }, false);
    if (field === 'name') update(v => { v.kit.name = event.target.value; }, false);
  });
  root.addEventListener('click', async event => {
    const act = event.target.closest('[data-act]')?.dataset.act, tabButton = event.target.closest('[data-stab]');
    if (tabButton) { tab = tabButton.dataset.stab; refresh(); return; }
    if (!act) return;
    if (act === 'celebrate') stage?.celebrate(draft.celebration);
    else if (act === 'view') { view = view === 'full' ? 'bust' : 'full'; stage?.setView(view); const b = $('[data-act="view"]'); b.textContent = view === 'full' ? 'Buste' : 'En pied'; b.setAttribute('aria-pressed', String(view === 'bust')); }
    else if (act === 'reset') stage?.resetCamera();
    else if (act === 'shop') options.openShop?.(unownedIds(draft, owned)[0]);
    else if (act === 'cancel') { draft = saved; stage?.setLook(draft); refresh(); }
    else if (act === 'save') await save();
  });
  root.addEventListener('keydown', event => { if (event.target.closest('[role="tab"]') && ['ArrowRight', 'ArrowLeft'].includes(event.key)) { const index = tabs.findIndex(([id]) => id === tab), next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length][0]; tab = next; refresh(); $(`#stab-${next}`).focus(); event.preventDefault(); } });

  async function save() {
    if (!options.authenticated) { toast('Connectez-vous pour enregistrer votre avatar'); options.openJoin?.('login'); return; }
    busy = true; refresh(); const label = $('[data-act="save"]'); label.textContent = 'Enregistrement…';
    try {
      const { config, dropped } = stripUnowned(draft, owned);
      let blobs = null;
      if (stage) { stage.setLook(config); try { const bust = await stage.snapshot('bust'), full = await stage.snapshot('full'); blobs = { bust, full }; } catch (error) { console.warn('Image de l’avatar non générée', error?.message); } stage.setLook(draft); }
      saved = sanitizeAvatar(await options.save(config, blobs));
      if (!dropped.length) draft = saved;
      toast(dropped.length ? `Avatar enregistré sans : ${dropped.map(nameOf).join(', ')}` : 'Avatar enregistré');
      options.onSaved?.(saved);
    } catch (error) { toast(error.message || 'Enregistrement impossible'); }
    busy = false; label.textContent = options.saveLabel ?? 'Enregistrer'; refresh();
  }

  // Éléments possédés (boutique) et débloqués par division : chargés en parallèle de la scène.
  const contextPromise = options.loadContext ? options.loadContext().catch(() => ({ inventory: [], unlocks: [] })) : Promise.resolve({ inventory: [], unlocks: [] });
  refresh();
  contextPromise.then(context => { if (destroyed) return; owned = ownedIds(context.inventory, context.unlocks); refresh(); });
  try {
    const { createStage, webglSupported } = await import('./avatar.js');
    if (!webglSupported()) throw new Error('WEBGL');
    host.innerHTML = '';
    stage = await createStage(host, { look: draft, view, label: 'Aperçu de votre avatar en 3D', onLost: () => { off = true; showOff('Le rendu 3D a été interrompu par l’appareil.'); } });
    if (destroyed) { stage.dispose(); stage = null; return { destroy() {} }; }
  } catch (error) { off = true; showOff(error.message === 'WEBGL' ? 'Votre appareil ne permet pas l’aperçu 3D.' : 'Le studio 3D n’a pas pu démarrer. Vérifiez votre connexion et réessayez.'); }
  function showOff(message) { stage?.dispose(); stage = null; host.innerHTML = `<div class="studio-off">${avatarMarkup({ avatar_config: saved }, { cls: 'avatar-3d', kind: 'full', userId: options.userId, label: 'Votre avatar' })}<p>${html(message)}</p><p class="muted">Votre avatar enregistré reste affiché partout sur le site.</p></div>`; root.classList.add('studio-disabled'); refresh(); }
  refresh();
  return {
    getConfig: () => draft, isDirty: dirty, setDraft(config) { draft = sanitizeAvatar(config); stage?.setLook(draft); refresh(); },
    destroy() { destroyed = true; stage?.dispose(); stage = null; root.innerHTML = ''; }
  };
}
