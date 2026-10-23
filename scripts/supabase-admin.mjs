// Client REST minimal pour Supabase avec la clé service_role : utilisé uniquement par les workflows GitHub Actions.
// La clé SUPABASE_SERVICE_ROLE_KEY n'existe que dans les secrets GitHub : elle ne doit jamais atteindre le navigateur ni data/.
export function createAdmin(env = process.env, fetcher = fetch) {
  const url = (env.SUPABASE_URL ?? '').replace(/\/$/, ''), key = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!/^https:\/\/.+\.supabase\.co$/.test(url) || key.length < 20) return null;
  const call = async (path, init = {}) => {
    const response = await fetcher(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers } });
    if (!response.ok) throw new Error(`Supabase ${path.split('?')[0]} : HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
  return {
    select: (table, query = '') => call(`${table}?${query}`),
    // Lecture complète par pages de 1 000 lignes (limite par défaut de PostgREST).
    selectAll: async (table, query = '') => { const rows = []; for (let offset = 0; ; offset += 1000) { const page = await call(`${table}?${query}&limit=1000&offset=${offset}`); rows.push(...page); if (page.length < 1000) return rows; } },
    insertIgnore: async (table, rows, conflict) => { for (let i = 0; i < rows.length; i += 500) await call(`${table}?on_conflict=${conflict}`, { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) }); },
    patch: (table, query, body) => call(`${table}?${query}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) }),
    insert: (table, rows) => rows.length ? call(table, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) }) : null,
    upsert: async (table, rows, conflict = 'id') => { for (let i = 0; i < rows.length; i += 500) await call(`${table}?on_conflict=${conflict}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) }); },
    rpc: (name, args = {}) => call(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) })
  };
}
