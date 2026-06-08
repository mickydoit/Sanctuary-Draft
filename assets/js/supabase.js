// Tiny dependency-free Supabase (PostgREST) client. Uses the public anon key,
// which is designed to be embedded in a browser app. No build step, no CDN.

const cfg = (typeof window !== 'undefined' && window.LBH_CONFIG) || {};
const URL_BASE = cfg.SUPABASE_URL ? cfg.SUPABASE_URL.replace(/\/+$/, '') : '';
const KEY = cfg.SUPABASE_ANON_KEY || '';

export const supabaseEnabled = Boolean(URL_BASE && KEY);

const REST = `${URL_BASE}/rest/v1`;
function headers(extra = {}) {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...extra };
}

async function handle(res) {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${body || res.statusText}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** GET a table. `query` is a PostgREST query string, e.g. "select=*&order=ranking.asc". */
export async function sbSelect(table, query = 'select=*') {
  const res = await fetch(`${REST}/${table}?${query}`, { headers: headers() });
  return handle(res);
}

/** INSERT one or many rows; returns the inserted rows. */
export async function sbInsert(table, rows) {
  const res = await fetch(`${REST}/${table}`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(rows),
  });
  return handle(res);
}

/** PATCH rows matching the PostgREST filter (e.g. "id=eq.1"). */
export async function sbUpdate(table, filter, patch) {
  const res = await fetch(`${REST}/${table}?${filter}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  });
  return handle(res);
}

/** DELETE rows matching the PostgREST filter. */
export async function sbDelete(table, filter) {
  const res = await fetch(`${REST}/${table}?${filter}`, { method: 'DELETE', headers: headers({ Prefer: 'return=minimal' }) });
  return handle(res);
}
