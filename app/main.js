// A make.fun frontend: board, bounty pages, leaderboards and profiles, on
// hash routes. window.__shotReady is true once a page's data is on screen.
// Detail views load later, by import(), so the first load stays small.

import { getBounties } from './api.js';
import { date, entries as entriesText, esc, money, num, timeLeft } from './format.js';

const app = document.getElementById('app');
const updated = document.getElementById('updated');
const lookup = document.getElementById('lookup');

let boardCache = null;
let countdownTimer = null;

/** Failed-load shell with a retry button. */
function failed(err, what) {
  return `<div class="error"><p>Could not load ${esc(what)}.</p><p>${esc(err.message)}</p><p><button class="btn" onclick="location.reload()">Retry</button></p></div>`;
}

/** Tick the live countdowns every 30 s while a page is shown. */
function startCountdowns() {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    document.querySelectorAll('[data-deadline]').forEach((el) => {
      el.textContent = timeLeft(el.dataset.deadline);
    });
  }, 30000);
}

/** Only open bounties (the endpoint also returns ended ones). */
function openOnly(items) {
  return items.filter((b) => new Date(b.deadline).getTime() > Date.now());
}

/** One bounty as a card on the board. */
function card(b) {
  const pot = b.potUsd ?? b.rewardAmount;
  const soon = new Date(b.deadline).getTime() - Date.now() < 86400000;
  return `<li class="card" data-search="${esc(`${b.title} ${b.slug} ${b.category}`.toLowerCase())}" data-category="${esc(b.category)}" data-pot="${Number(pot) || 0}" data-deadline="${esc(b.deadline)}" data-opens="${esc(b.opensAt ?? '')}" data-entries="${b.submissionCount}">
    <div class="card-top"><span class="tag">${esc(b.category)}</span><span class="pot">${money(pot)}</span></div>
    <h2><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h2>
    <p class="summary">${esc(b.summary ?? '')}</p>
    <dl class="meta">
      <div><dt>Entry fee</dt><dd>${b.entryFeeUsd ? money(b.entryFeeUsd) : 'Free'}</dd></div>
      <div><dt>Time left</dt><dd data-deadline="${esc(b.deadline)}" class="${soon ? 'soon' : ''}">${timeLeft(b.deadline)}</dd></div>
      <div><dt>Entries</dt><dd>${entriesText(b.submissionCount)}</dd></div>
      <div><dt>Reward</dt><dd>${money(b.rewardAmount)}</dd></div>
    </dl>
    <p class="deadline">Ends ${esc(date(b.deadline))}</p>
  </li>`;
}

/** The board: stats, search, sort, category chips, cards. */
function boardPage(items) {
  const totalPot = items.reduce((s, b) => s + (Number(b.potUsd ?? b.rewardAmount) || 0), 0);
  const closing = items.filter((b) => new Date(b.deadline).getTime() - Date.now() < 86400000).length;
  const cats = [...new Set(items.map((b) => b.category))].sort();
  return `<h1>Open bounties</h1>
  <p class="lede">Live bounties on make.fun — rewards, entry fees and time left, updated from the public API.</p>
  <div class="stats">
    <div class="stat"><b>${num(items.length)}</b><span>open bounties</span></div>
    <div class="stat"><b>${money(totalPot)}</b><span>total live pot</span></div>
    <div class="stat"><b>${num(closing)}</b><span>closing within 24h</span></div>
  </div>
  <div class="toolbar">
    <input id="q" type="search" placeholder="Search bounties…" aria-label="Search bounties" autocomplete="off">
    <select id="sort" aria-label="Sort bounties">
      <option value="ending">Ending soon</option>
      <option value="pot">Biggest reward</option>
      <option value="entries">Most entries</option>
      <option value="newest">Newest</option>
    </select>
    <div class="chips" id="cats">
      <button class="chip" data-cat="" aria-pressed="true">All</button>
      ${cats.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}
    </div>
  </div>
  <p class="count" id="board-count"></p>
  ${items.length ? `<ul class="board" id="board">${items.map(card).join('')}</ul>` : '<p class="empty">No open bounties right now.</p>'}
  <p class="empty" id="no-match" hidden>No bounties match that search.</p>`;
}

/** Apply search, sort and category to the cards on the page. */
function applyBoardFilters() {
  const list = document.getElementById('board');
  if (!list) return;
  const q = (document.getElementById('q').value || '').trim().toLowerCase();
  const sort = document.getElementById('sort').value;
  const cat = document.querySelector('#cats .chip[aria-pressed="true"]')?.dataset.cat ?? '';
  const cards = [...list.children];
  const visible = cards.filter((li) => {
    const okQ = !q || li.dataset.search.includes(q);
    const okC = !cat || li.dataset.category === cat;
    li.hidden = !(okQ && okC);
    return okQ && okC;
  });
  const key = {
    ending: (a, b) => a.dataset.deadline.localeCompare(b.dataset.deadline),
    pot: (a, b) => Number(b.dataset.pot) - Number(a.dataset.pot),
    entries: (a, b) => Number(b.dataset.entries) - Number(a.dataset.entries),
    newest: (a, b) => (b.dataset.opens || '').localeCompare(a.dataset.opens || ''),
  }[sort];
  visible.sort(key).forEach((li) => list.appendChild(li));
  document.getElementById('no-match').hidden = visible.length > 0;
  document.getElementById('board-count').textContent = `Showing ${num(visible.length)} of ${num(cards.length)} bounties`;
}

/** Render the board (fetch once, cache for the session). */
async function renderBoard() {
  if (!boardCache) boardCache = await getBounties();
  const items = openOnly(boardCache.items);
  app.innerHTML = boardPage(items);
  document.getElementById('q').addEventListener('input', applyBoardFilters);
  document.getElementById('sort').addEventListener('change', applyBoardFilters);
  document.getElementById('cats').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.chip');
    if (!btn) return;
    document.querySelectorAll('#cats .chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    applyBoardFilters();
  });
  applyBoardFilters();
  startCountdowns();
}

/** Render a detail route (loaded by import()). */
async function renderDetail(kind, arg) {
  const mod = await import('./views-detail.js');
  const api = await import('./api.js');
  if (kind === 'bounty') {
    app.innerHTML = mod.bountyPage(await api.getBounty(arg));
  } else if (kind === 'leaderboard') {
    const lb = await api.getLeaderboard(arg);
    app.innerHTML = mod.leaderboardPage(lb, arg);
    document.getElementById('lb-more')?.addEventListener('click', (ev) => {
      document.getElementById('lb-rows').insertAdjacentHTML('beforeend', mod.restRows(lb));
      ev.target.closest('p')?.remove();
    });
  } else {
    app.innerHTML = mod.profilePage(await api.getProfile(arg));
  }
  // A failed avatar image is removed, leaving its initial behind.
  app.querySelectorAll('img.avatar').forEach((img) => {
    img.addEventListener('error', () => img.remove());
    if (img.complete && img.naturalWidth === 0) img.remove();
  });
  startCountdowns();
}

/** Route the hash to a page. */
async function render() {
  window.__shotReady = false;
  const hash = location.hash || '#/';
  try {
    const lb = hash.match(/^#\/bounty\/([^/]+)\/leaderboard\/?$/);
    const bounty = hash.match(/^#\/bounty\/([^/]+)\/?$/);
    const profile = hash.match(/^#\/u\/([^/]+)\/?$/);
    document.title = lb ? 'Leaderboard — make.fun bounties' : bounty ? 'Bounty — make.fun bounties' : profile ? `@${decodeURIComponent(profile[1])} — make.fun bounties` : 'make.fun bounties';
    if (lb) await renderDetail('leaderboard', decodeURIComponent(lb[1]));
    else if (bounty) await renderDetail('bounty', decodeURIComponent(bounty[1]));
    else if (profile) await renderDetail('profile', decodeURIComponent(profile[1]));
    else await renderBoard();
    updated.textContent = `Updated ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`;
  } catch (err) {
    app.innerHTML = failed(err, 'this page');
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

lookup.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const handle = new FormData(lookup).get('handle').trim().replace(/^@/, '');
  if (handle) location.hash = `#/u/${encodeURIComponent(handle)}`;
  else document.getElementById('lookup-input').focus();
});

window.addEventListener('hashchange', render);
render();
