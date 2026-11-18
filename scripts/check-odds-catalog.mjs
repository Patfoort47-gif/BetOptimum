// Diagnostic borné : une requête au catalogue, jamais une requête de prix.
if (!process.env.PROPLINE_API_KEY) throw new Error('Secret fournisseur absent');
const response = await fetch('https://api.prop-line.com/v1/sports', {
  headers: { 'X-API-Key': process.env.PROPLINE_API_KEY },
  signal: AbortSignal.timeout(20000),
  redirect: 'error'
});
if (!response.ok) throw new Error(`Catalogue fournisseur : HTTP ${response.status}`);
const catalog = await response.json();
if (!Array.isArray(catalog)) throw new Error('Format de catalogue non reconnu');
const sports = catalog
  .filter((s) => /^soccer_[a-z0-9_]+$/.test(s.key))
  .map(({ key, title, active, has_outrights }) => ({ key, title, active, has_outrights }));
console.log('::notice title=Compétitions fournisseur::' + JSON.stringify(sports));
