// The detail views — a bounty, a leaderboard and a profile — loaded later by
// import(), so they never weigh on the board's first load. Each is a pure
// function from API data to HTML.

import { date, dateOnly, entries as entriesText, esc, money, num, pct, shortAddr, timeLeft } from './format.js';

/** How many leaderboard rows render at first; the rest load on one click. */
const LB_LIMIT = 100;

/** 1st, 2nd, 3rd, 4th… */
function place(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** A tiny Markdown renderer for bounty descriptions: headings, lists, bold, code and links. */
function md(text) {
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
      .replace(/\*\*([^*]+)\*\*/g, (_, b) => `<strong>${b}</strong>`)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
  const blocks = String(text ?? '').split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split('\n').filter((l) => l.trim() !== '');
      if (lines.length === 0) return '';
      if (lines[0].startsWith('### ')) return `<h3>${inline(lines[0].slice(4))}</h3>` + lines.slice(1).map((l) => `<p>${inline(l)}</p>`).join('');
      if (lines[0].startsWith('## ')) return `<h2>${inline(lines[0].slice(3))}</h2>` + lines.slice(1).map((l) => `<p>${inline(l)}</p>`).join('');
      if (lines[0].startsWith('# ')) return `<h2>${inline(lines[0].slice(2))}</h2>` + lines.slice(1).map((l) => `<p>${inline(l)}</p>`).join('');
      if (lines.every((l) => l.startsWith('- '))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
      if (lines.every((l) => /^\d+\. /.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`;
      if (lines[0].startsWith('```')) return `<pre><code>${esc(lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined).join('\n'))}</code></pre>`;
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}

/** The rewards map {"1": 100, ...} as a payout table. */
function payoutTable(rewards) {
  const rows = Object.entries(rewards || {})
    .map(([k, v]) => [Number(k), Number(v)])
    .filter(([k, v]) => Number.isFinite(k) && Number.isFinite(v))
    .sort((a, b) => a[0] - b[0]);
  if (rows.length === 0) return '';
  const total = rows.reduce((s, [, v]) => s + v, 0);
  return `<h2>Rewards — top ${num(rows.length)} share ${money(total)}</h2>
  <table class="payouts">
    <thead><tr><th>Place</th><th>Prize</th></tr></thead>
    <tbody>${rows.map(([k, v]) => `<tr><td>${place(k)}</td><td>${money(v)}</td></tr>`).join('')}</tbody>
  </table>`;
}

/** One bounty: facts, rewards, description, and links to its leaderboard and make.fun. */
export function bountyPage(b) {
  const pot = b.potUsd ?? b.rewardAmount;
  const soon = new Date(b.deadline).getTime() - Date.now() < 86400000;
  return `<p><a class="back" href="#/">← All bounties</a></p>
  <span class="tag">${esc(b.category)}</span>
  <h1>${esc(b.title)}</h1>
  <p class="lede">${esc(b.summary ?? '')}</p>
  <dl class="facts">
    <div class="fact"><dt>Live pot</dt><dd>${money(pot)}<small>reward ${money(b.rewardAmount)}</small></dd></div>
    <div class="fact"><dt>Entry fee</dt><dd>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</dd></div>
    <div class="fact"><dt>Entries</dt><dd>${entriesText(b.submissionCount)}</dd></div>
    <div class="fact"><dt>Time left</dt><dd data-deadline="${esc(b.deadline)}" class="${soon ? 'soon' : ''}">${timeLeft(b.deadline)}</dd><small>ends ${dateOnly(b.deadline)}</small></div>
    <div class="fact"><dt>Opened</dt><dd>${dateOnly(b.opensAt)}<small>${esc(b.sponsor?.name ?? '')}</small></dd></div>
  </dl>
  <div class="actions">
    <a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard →</a>
    <a class="btn ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}" target="_blank" rel="noopener">View on make.fun ↗</a>
  </div>
  ${b.skills?.length ? `<p>${b.skills.map((s) => `<span class="tag">${esc(s)}</span>`).join(' ')}</p>` : ''}
  ${payoutTable(b.rewards)}
  <h2>About this bounty</h2>
  <div class="description">${md(b.description)}</div>`;
}

/** An avatar image, or null when the entry has none (the caller shows an initial). */
function avatarSrc(image) {
  if (!image) return null;
  if (image.startsWith('/')) return `https://make.fun${image}`;
  return image;
}

/** An avatar: the image over its initial, so a failed image still shows the initial. */
function avatar(handle, image) {
  const initial = `<span class="initial">${esc((handle || '?')[0])}</span>`;
  const src = avatarSrc(image);
  if (!src) return initial;
  return `<span class="avatar-wrap">${initial}<img class="avatar" src="${esc(src)}" alt="" loading="lazy"></span>`;
}

/** The columns a leaderboard shows, chosen by what it ranks on: judged boards
    show the win rate and dossier size; Elo boards show the record. */
function columnsFor(lb) {
  if (lb.rank_key === 'judge') {
    return [
      {
        title: 'Judge win rate',
        html: (e) => `${pct(e.values?.judge)}<br><small style="color:var(--muted);font-weight:400">${pct(e.values?.judge_low)} – ${pct(e.values?.judge_high)}</small>`,
      },
      {
        title: 'Dossier',
        html: (e) => (Number.isFinite(Number(e.values?.bytes)) ? `${(Number(e.values.bytes) / 1024).toFixed(0)} KB` : '—'),
      },
    ];
  }
  if (lb.rank_key === 'elo') {
    return [
      { title: 'Elo', html: (e) => num(e.values?.elo) },
      { title: 'W', html: (e) => num(e.values?.wins) },
      { title: 'D', html: (e) => num(e.values?.draws) },
      { title: 'L', html: (e) => num(e.values?.losses) },
    ];
  }
  return (lb.columns || [])
    .filter((c) => !c.hidden)
    .map((c) => ({ title: c.title, html: (e) => esc(e.display?.[c.key] ?? e.values?.[c.key] ?? '—') }));
}

/** One leaderboard row. */
function row(e, cols) {
  const paid = Number(e.prize_rank) > 0 && Number(e.prize_rank) <= 20;
  return `<tr class="${paid ? 'paid' : ''}">
      <td class="rank medal-${e.rank <= 3 ? e.rank : 0}">${num(e.rank)}</td>
      <td><span class="who">${avatar(e.handle, e.image)}<span><a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a><br><span class="entry-title" title="${esc(e.title ?? '')}">${esc(e.title ?? '')}</span></span></span></td>
      ${cols.map((c) => `<td class="num">${c.html(e)}</td>`).join('')}
    </tr>`;
}

/** The rows past the first LB_LIMIT, for the "show all" button. */
export function restRows(lb) {
  const cols = columnsFor(lb);
  return (lb.entries || []).slice(LB_LIMIT).map((e) => row(e, cols)).join('');
}

/** A bounty's leaderboard: rank, handle, entry, and the judge's numbers. */
export function leaderboardPage(lb, slug) {
  const cols = columnsFor(lb);
  const all = lb.entries || [];
  return `<p><a class="back" href="#/bounty/${encodeURIComponent(slug)}">← ${esc(lb.competition?.title ?? slug)}</a></p>
  <h1>Leaderboard</h1>
  <p class="lede">${esc(lb.competition?.title ?? '')} — ${num(all.length)} ranked entries. Rows in green are inside the paid top 20.</p>
  <div style="overflow-x:auto">
  <table class="lb">
    <thead><tr><th>#</th><th>Entry</th>${cols.map((c) => `<th class="num">${esc(c.title)}</th>`).join('')}</tr></thead>
    <tbody id="lb-rows">${all.slice(0, LB_LIMIT).map((e) => row(e, cols)).join('') || '<tr><td colspan="99" class="empty">No ranked entries yet.</td></tr>'}</tbody>
  </table>
  </div>
  ${all.length > LB_LIMIT ? `<p><button class="btn" id="lb-more">Show all ${num(all.length)} entries</button></p>` : ''}`;
}

/** One account's public profile: identity, record, and every entry. */
export function profilePage(p) {
  const rec = p.record || {};
  const sols = (p.solutions || [])
    .map((s) => {
      const score = s.score?.column?.key === 'judge' ? pct(s.score.value) : s.score?.column?.key === 'elo' ? num(s.score.value) : esc(s.score?.display ?? '—');
      return `<tr>
      <td><a href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.competition.title)}</a></td>
      <td>${s.placement ? num(s.placement) : '—'}</td>
      <td class="num">${s.prize_usd ? money(s.prize_usd) : '—'}</td>
      <td class="num">${score}</td>
    </tr>`;
    })
    .join('');
  return `<p><a class="back" href="#/">← All bounties</a></p>
  <div class="profile-head">${avatar(p.handle, p.image || p.avatar)}<div>
    <h1>${esc(p.display_name || p.handle)}</h1>
    <p class="bio">@${esc(p.handle)} · joined ${date(p.joined_at)}</p>
    ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
    ${p.wallet?.address ? `<p class="wallet"><a href="${esc(p.wallet.explorer_url)}" target="_blank" rel="noopener">${shortAddr(p.wallet.address)}</a></p>` : ''}
  </div></div>
  <div class="stats">
    <div class="stat"><b>${num(rec.competitions_entered)}</b><span>competitions entered</span></div>
    <div class="stat"><b>${num(rec.competitions_placed)}</b><span>placed · ${num(rec.competitions_won)} won</span></div>
    <div class="stat"><b>${money(rec.prize_usd)}</b><span>prize money won</span></div>
  </div>
  <h2>Entries</h2>
  ${sols ? `<div style="overflow-x:auto"><table class="lb">
    <thead><tr><th>Competition</th><th>Place</th><th class="num">Prize</th><th class="num">Score</th></tr></thead>
    <tbody>${sols}</tbody>
  </table></div>` : '<p class="empty">No entries yet.</p>'}`;
}
