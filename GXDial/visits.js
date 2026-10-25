// Счётчик посещений: сколько раз открывали каждую закладку.
// Хранится отдельно от закладок ({ адрес: { n, last } }), поэтому правка плитки счётчик не сбрасывает.
let visits = {};
let saveVisitsTimer = 0;

function visitsOf(url) { return (visits[url] && visits[url].n) || 0; }
function isBookmarkUrl(url) { return sections.some(s => linksOf(s).some(t => t.url === url)); }
function bumpVisit(url) {
  if (!url || !isBookmarkUrl(url)) return;
  const v = visits[url] || (visits[url] = { n: 0, last: 0 });
  v.n++; v.last = Date.now();
  clearTimeout(saveVisitsTimer);
  // страница сейчас уйдёт на сайт — пишем сразу, а не «потом»
  chrome.storage.local.set({ visits });
}
function resetVisits() {
  if (!confirm(L('Сбросить счётчик посещений у всех закладок?'))) return;
  visits = {};
  chrome.storage.local.set({ visits });
  render();
}

// «12 раз» / «12 visits»
function timesText(n) {
  if (LANG === 'en') return n === 1 ? '1 visit' : `${n} visits`;
  const m10 = n % 10, m100 = n % 100;
  const w = m10 === 1 && m100 !== 11 ? 'раз' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'раза' : 'раз';
  return `${n} ${w}`;
}
function visitBadge(n) {
  const b = el('span', 'visits');
  b.innerHTML = IC_V.eye;
  b.append(el('b', '', n > 999 ? Math.floor(n / 1000) + 'k' : String(n)));
  b.title = L('Открыто') + ': ' + timesText(n);
  return b;
}

// где лежит закладка: раздел, папка и номер — чтобы «Изменить» и «Удалить» работали и из блока «Часто открываю»
function allLinkLocs() {
  const out = [];
  sections.forEach(s => s.tiles.forEach((t, i) => {
    if (isFolder(t)) t.tiles.forEach((x, j) => out.push({ t: x, loc: { sec: s.id, folder: t.id }, i: j }));
    else out.push({ t, loc: { sec: s.id, folder: null }, i });
  }));
  return out;
}

// блок «Часто открываю» над разделами: один ряд самых посещаемых
function freqEl() {
  if (!S.freq) return null;
  const top = allLinkLocs().filter(x => visitsOf(x.t.url) > 0)
    .sort((a, b) => visitsOf(b.t.url) - visitsOf(a.t.url) || visits[b.t.url].last - visits[a.t.url].last)
    .slice(0, Math.max(1, S.cols));
  if (!top.length) return null;
  const box = el('section', 'section freq');
  box.style.setProperty('--i', 0);
  const head = el('div', 'sec-head');
  const star = el('span', 'freq-ic');
  star.innerHTML = IC_V.flame;
  const title = el('h2', 'sec-title', L('Часто открываю'));
  const line = el('div', 'sec-line');
  const hide = iconBtn('st st-hide', IC_V.off, 'Скрыть блок «Часто открываю»');
  hide.onclick = () => { S.freq = false; saveSettings(); fillForm(); render(); };
  const tools = el('div', 'sec-tools');
  tools.append(hide);
  head.append(star, title, el('span', 'count', top.length), line, tools);
  const grid = el('div', 'grid');
  top.forEach(x => {
    const a = tileEl(x.loc, x.t, x.i);
    a.draggable = false;               // порядок здесь задаёт счётчик, перетаскивать нечего
    a.classList.add('freq-item');
    grid.append(a);
  });
  box.append(head, grid);
  return box;
}

// сортировка раздела: ссылки по убыванию посещений, папки остаются на своих местах
function sortByVisits(s) {
  const slots = [], links = [];
  s.tiles.forEach((t, i) => { if (!isFolder(t)) { slots.push(i); links.push(t); } });
  const sorted = links.map((t, k) => ({ t, k })).sort((a, b) => visitsOf(b.t.url) - visitsOf(a.t.url) || a.k - b.k).map(x => x.t);
  slots.forEach((i, k) => { s.tiles[i] = sorted[k]; });
  saveSections(); render();
}

const IC_V = {
  eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  flame: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c4 0 7-2.7 7-6.8 0-3.8-2.6-6.3-4.2-8.7-.4 2-1.4 3.3-2.8 3.8.2-2.9-1-5.6-3.5-8.3-.3 3.8-2.2 6-3.6 8.1C3.7 12.3 5 14 5 15.2 5 19.3 8 22 12 22z"/></svg>',
  sort: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h11M4 18h6"/></svg>',
  off: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};
