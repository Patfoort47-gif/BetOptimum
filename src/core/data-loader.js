// Revalidation mutualisée, bornée même si le transport ignore l'annulation.
export function createJsonLoader(fetcher = (...args) => fetch(...args), { timeoutMs = 8000 } = {}) {
  const pending = new Map();
  return function load(url) {
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
      .then(() => fetcher(url, { cache: 'no-cache', signal: controller.signal }))
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      });
    const request = Promise.race([transport, timeout]).finally(() => {
      clearTimeout(timer);
      pending.delete(url);
    });
    pending.set(url, request);
    return request;
  };
}
