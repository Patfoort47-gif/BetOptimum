// Appliqué dans le head, avant les styles et le premier rendu.
(function () {
  if (typeof document === 'undefined') return;
  const key = 'betmaster-theme',
    valid = (value) => (value === 'light' || value === 'dark' ? value : null),
    media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  let preference = null,
    notify = () => {},
    bound = false;
  try {
    preference = valid(localStorage.getItem(key));
  } catch {}
  const current = () => preference ?? (media?.matches ? 'dark' : 'light');
  const apply = () => {
    const dark = current() === 'dark';
    document.documentElement.classList.toggle('light', !dark);
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = dark ? '#0A0C0B' : '#F2F4F0';
    document.querySelectorAll?.('[data-theme-choice]').forEach((input) => {
      input.checked = input.value === current();
    });
  };
  const change = () => {
    apply();
    notify();
  };
  apply();
  const choose = (value) => {
    if (!['system', 'light', 'dark'].includes(value)) return;
    preference = valid(value);
    try {
      if (preference === null) localStorage.removeItem(key);
      else localStorage.setItem(key, preference);
    } catch {}
    change();
  };
  const systemChange = () => {
    if (preference === null) change();
  };
  if (media?.addEventListener) media.addEventListener('change', systemChange);
  else media?.addListener?.(systemChange);
  globalThis.addEventListener?.('storage', (event) => {
    if (event.key !== key && event.key !== null) return;
    preference = valid(event.newValue);
    change();
  });
  globalThis.betOptimumTheme = Object.freeze({
    current,
    preference: () => preference ?? 'system',
    choose,
    bind(onChange) {
      notify = onChange ?? (() => {});
      apply();
      if (bound) return;
      bound = true;
      document.addEventListener?.('change', (event) => {
        if (event.target.matches?.('[data-theme-choice]')) choose(event.target.value);
      });
    }
  });
})();
