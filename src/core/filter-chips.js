export function enhanceFilterChips(select) {
  if (!select || select.dataset.chipsReady) return;
  select.dataset.chipsReady = '1';
  const label = select.closest('label'),
    field = document.createElement('div'),
    title = document.createElement('strong'),
    group = document.createElement('div');
  field.className = 'chip-field';
  title.textContent = label?.firstChild?.textContent.trim() || 'Filtrer';
  group.className = 'filter-chips';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', title.textContent);
  field.append(title, group);
  (label ?? select).after(field);
  (label ?? select).hidden = true;
  function render() {
    const focused = group.contains(document.activeElement)
      ? document.activeElement.dataset.value
      : null;
    group.replaceChildren(
      ...[...select.options].map((option) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'filter-chip';
        b.textContent = option.textContent;
        b.dataset.value = option.value;
        b.disabled = option.disabled;
        b.setAttribute('aria-pressed', String(option.value === select.value));
        return b;
      })
    );
    if (focused !== null)
      [...group.children].find((b) => b.dataset.value === focused)?.focus({ preventScroll: true });
  }
  group.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    select.value = button.dataset.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    render();
  });
  select.addEventListener('change', render);
  new MutationObserver(render).observe(select, {
    childList: true,
    subtree: true,
    attributes: true
  });
  select.form?.addEventListener('reset', () => queueMicrotask(render));
  document.addEventListener('click', (event) => {
    if (event.target.closest('#reset-prediction-filters,#reset-history')) queueMicrotask(render);
  });
  render();
  return { render };
}
