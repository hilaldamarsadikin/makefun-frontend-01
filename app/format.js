// Small helpers for showing API values.

/** Escape text for HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount as '$1,000' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
}

/** A plain number with thousands separators. */
export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

/** A date, or null when the input is not a date. */
function asDate(iso) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d; }

/** A deadline as a date in UTC. */
export function date(iso) {
  const d = asDate(iso);
  return d ? `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC` : '—';
}

/** A deadline as a date in UTC, without the time. */
export function dateOnly(iso) {
  const d = asDate(iso);
  return d ? `${d.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })} UTC` : '—';
}

/** The time until a deadline: '2d 4h left', '35m left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return `${Math.floor(ms / 1000)}s left`;
}

/** A judge win rate in micro units (950587) as '95.1%'. */
export function pct(micro) {
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  return `${Math.min(100, Math.max(0, n / 10000)).toFixed(1)}%`;
}

/** A wallet address shortened for display. */
export function shortAddr(addr) {
  const s = String(addr ?? '');
  return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
}

/** '1 entry' or '3 entries'. */
export function entries(n) {
  return `${num(n)} ${Number(n) === 1 ? 'entry' : 'entries'}`;
}
