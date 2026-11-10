// Les erreurs d'image ne remontent pas : écoute en capture, sans attribut JavaScript inline.
export function imageFallback(image) {
  if (image?.dataset?.imageFallback === 'logo') {
    image.parentNode?.classList.add('no-logo');
    image.remove();
  } else if (image?.dataset?.imageFallback === 'remove') image.parentNode?.remove();
}
export function installImageFallbacks(root) {
  root.addEventListener?.('error', (event) => imageFallback(event.target), true);
}
