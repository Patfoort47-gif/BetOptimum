// Revalidation mutualisée, bornée même si le transport ignore l'annulation.
export function createJsonLoader(fetcher = (...args) => fetch(...args), { timeoutMs = 8000 } = {}) {
  const pending = new Map();
  return function load(url, mark) {
    if (pending.has(url)) return pending.get(url);
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Délai de chargement dépassé'));
        controller.abort();
      }, timeoutMs);
      timer.unref?.();
    });
    const transport = Promise.resolve()
      .then(() => {
        mark?.('requete');
        return fetcher(url, { cache: 'no-cache', signal: controller.signal });
      })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!mark) return response.json();
        return response.text().then((body) => {
          mark('corps-recu');
          const data = JSON.parse(body);
          mark('json-parse');
          return data;
        });
      });
    const request = Promise.race([transport, timeout]).finally(() => {
      clearTimeout(timer);
      pending.delete(url);
    });
    pending.set(url, request);
    return request;
  };
}
