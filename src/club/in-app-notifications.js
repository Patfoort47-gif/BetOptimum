// Historique local propre au compte, alimenté exclusivement par les réponses du serveur.
export function createInbox(storage, key) {
  let state = { items: [], groups: {} };
  try {
    const saved = JSON.parse(storage?.getItem(key) || 'null');
    if (saved && Array.isArray(saved.items) && saved.groups && typeof saved.groups === 'object')
      state = {
        ...saved,
        items: saved.items.filter((item) => !String(item.id).startsWith('rank:'))
      };
  } catch {}
  const save = () => {
    try {
      storage?.setItem(key, JSON.stringify(state));
    } catch {}
  };
  const add = (id, text, tab) => {
    if (state.items.some((item) => item.id === id)) return;
    state.items.unshift({ id, text, tab, at: Date.now(), read: false });
    state.items = state.items.slice(0, 100);
  };
  const observe = (group, keys, make) => {
    const previous = state.groups[group];
    if (Array.isArray(previous))
      for (const value of keys)
        if (!previous.includes(value)) {
          const item = make(value);
          if (item) add(...item);
        }
    state.groups[group] = [
      ...new Set([...(Array.isArray(previous) ? previous : []), ...keys])
    ].slice(-2000);
    save();
  };
  return {
    bets(rows) {
      observe(
        'bets',
        rows.filter((b) => ['won', 'lost'].includes(b.status)).map((b) => `${b.id}:${b.status}`),
        (id) => [
          id,
          id.endsWith(':won') ? 'Votre ticket est gagné.' : 'Votre ticket est perdu.',
          'bankroll'
        ]
      );
    },
    rewards(data) {
      if (!data) return;
      const results = data.results ?? [];
      observe(
        'challenges',
        results.map((r) => `${r.week_start}:${r.challenge_id}`),
        (id) => {
          return [
            'challenge:' + id,
            'Le résultat de votre défi hebdomadaire est disponible.',
            'challenges'
          ];
        }
      );
    },
    items: () => state.items.map((i) => ({ ...i })),
    unread: () => state.items.filter((i) => !i.read).length,
    read(id) {
      state.items.forEach((i) => {
        if (!id || i.id === id) i.read = true;
      });
      save();
    }
  };
}
export function initInbox({ navigate }) {
  const button = document.querySelector('#open-inbox'),
    dialog = document.querySelector('#inbox-dialog'),
    list = dialog.querySelector('[data-inbox-list]'),
    markRead = dialog.querySelector('[data-inbox-read]'),
    close = dialog.querySelector('[data-inbox-close]');
  let inbox = null;
  const esc = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function render() {
    button.hidden = !inbox;
    const count = inbox?.unread() ?? 0;
    button.setAttribute('aria-label', `Notifications : ${count} non lue${count > 1 ? 's' : ''}`);
    const badge = button.querySelector('b');
    badge.textContent = count ? String(count) : '';
    badge.hidden = count === 0;
    markRead.disabled = count === 0;
    const items = inbox?.items() ?? [];
    const focusedId = dialog.ownerDocument.activeElement?.dataset.inboxId;
    list.innerHTML =
      items
        .map(
          (i) =>
            `<li class="${i.read ? '' : 'unread'}"><button class="button ghost" data-inbox-id="${esc(i.id)}"><span>${esc(i.text)}</span><time>${new Date(i.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</time>${i.read ? '' : '<small>Non lue</small>'}</button></li>`
        )
        .join('') || '<li class="inbox-empty">Aucune notification pour le moment.</li>';
    if (focusedId && dialog.open) {
      const item = [...list.querySelectorAll('[data-inbox-id]')].find(
        (entry) => entry.dataset.inboxId === focusedId
      );
      (item ?? close).focus();
    }
  }
  button.addEventListener('click', () => {
    render();
    dialog.showModal();
    close.focus();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (!button.hidden && dialog.ownerDocument.activeElement === dialog.ownerDocument.body)
      button.focus();
  });
  markRead.addEventListener('click', () => {
    inbox?.read();
    render();
    close.focus();
  });
  list.addEventListener('click', (event) => {
    const id = event.target.closest('[data-inbox-id]')?.dataset.inboxId,
      item = inbox?.items().find((i) => i.id === id);
    if (!item) return;
    inbox.read(id);
    render();
    dialog.close();
    navigate(item.tab);
  });
  return {
    account(id) {
      dialog.close();
      let storage = null;
      try {
        storage = localStorage;
      } catch {}
      inbox = id ? createInbox(storage, 'betoptimum-inbox:' + id) : null;
      render();
    },
    bets(rows) {
      inbox?.bets(rows);
      render();
    },
    rewards(data) {
      inbox?.rewards(data);
      render();
    }
  };
}
