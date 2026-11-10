export function createAttention(storage, key) {
  let saved = {};
  try {
    saved = JSON.parse(storage.getItem(key) || '{}') || {};
  } catch {}
  const persist = () => {
    try {
      storage.setItem(key, JSON.stringify(saved));
    } catch {}
  };
  return {
    update(group, keys, visible = false) {
      const known = Array.isArray(saved[group]?.known) ? saved[group].known : null,
        pending =
          Boolean(saved[group]?.pending) ||
          Boolean(known && keys.some((key) => !known.includes(key)));
      saved[group] = {
        known: [...new Set([...(known ?? []), ...keys])].slice(-1000),
        pending: visible ? false : pending
      };
      persist();
      return saved[group].pending;
    },
    clear(group) {
      if (saved[group]) {
        saved[group].pending = false;
        persist();
      }
    },
    pending(group) {
      return Boolean(saved[group]?.pending);
    }
  };
}
