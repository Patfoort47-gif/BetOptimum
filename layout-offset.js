export function initHeaderOffset() {
  if (typeof window === 'undefined') return;
  const header = document.querySelector('.topbar');
  if (!header) return;
  const update = () =>
    document.documentElement.style.setProperty(
      '--header-offset',
      `${Math.ceil(header.getBoundingClientRect().height) + 12}px`
    );
  update();
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(update).observe(header);
  else window.addEventListener('resize', update);
}
