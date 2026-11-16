// make.fun's public API: read-only GET requests, open to any origin (CORS).
// Full API: https://make.fun/api/openapi.json
const API = 'https://make.fun/api';

/** GET one API path as JSON (30 s timeout). */
async function get(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(API + path, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`make.fun API ${res.status} for ${path}`);
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`make.fun API timed out for ${path}`);
    throw err;
  } finally { clearTimeout(t); }
}

/** The bounty board: { items: [...] }. */
export const getBounties = () => get('/competitions?status=open&activity=times');

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** One bounty's leaderboard: { competition, columns, entries, rank_key }. */
export const getLeaderboard = (slug) => get(`/competitions/${encodeURIComponent(slug)}/leaderboard`);

/** One account's public profile, by its handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
