// Строка поиска: Google + поиск по своим закладкам.
// Пока печатаешь, подходящие плитки подсвечиваются, остальные приглушаются; в списке — Google и найденные закладки.
const qForm = $('search'), qInput = $('q'), qList = $('qList');
let qItems = [], qSel = 0;

const GOOGLE = q => 'https://www.google.com/search?q=' + encodeURIComponent(q);
function looksLikeUrl(q) {
  if (/\s/.test(q)) return false;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(q) || /^localhost(:\d+)?(\/|$)/i.test(q) || /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(q);
}
// чем раньше совпадение и чем оно «главнее» (название, потом адрес), тем выше в списке
function scoreOf(t, ql) {
  const title = (t.title || '').toLowerCase(), host = hostOf(t.url).toLowerCase(), url = t.url.toLowerCase();
  if (title.startsWith(ql)) return 100;
  if (host.startsWith(ql) || host.split('.').some(p => p.startsWith(ql))) return 80;
  if (title.split(/[\s\-–—_.,:]+/).some(w => w.startsWith(ql))) return 60;
  if (title.includes(ql)) return 40;
  if (url.includes(ql)) return 20;
  return 0;
}
function findBookmarks(ql) {
  const out = [];
  sections.forEach(s => {
    const walk = (list, folder) => list.forEach(t => {
      if (isFolder(t)) return walk(t.tiles, t);
      const sc = scoreOf(t, ql);
      if (sc) out.push({ t, s, folder, sc });
    });
    walk(s.tiles, null);
  });
  return out.sort((a, b) => b.sc - a.sc).slice(0, 6);
}

// подсветка плиток на странице
function markTiles(ql) {
  document.body.classList.toggle('searching', !!ql);
  root.querySelectorAll('[data-search]').forEach(x => x.classList.toggle('hit', !!ql && x.dataset.search.includes(ql)));
}

function rowEl(item, i) {
  const r = el('div', 'q-row' + (i === qSel ? ' on' : ''));
  r.setAttribute('role', 'option');
  if (item.kind === 'web') {
    const ic = el('span', 'q-ic');
    ic.innerHTML = item.open ? IC_Q.globe : IC_Q.search;
    const tx = el('span', 'q-tx');
    tx.append(el('span', 'q-pre', L(item.open ? 'Открыть' : 'Найти в Google') + ' '), el('b', '', item.q));
    r.append(ic, tx, el('kbd', 'q-enter', 'Enter'));
  } else {
    const ic = el('span', 'q-ic');
    ic.append(favEl(item.t, 18));
    const tx = el('span', 'q-tx');
    tx.append(el('b', '', item.t.title || hostOf(item.t.url)), el('span', 'q-host', hostOf(item.t.url)));
    const where = item.folder ? `${item.s.name} › ${item.folder.name}` : item.s.name;
    r.append(ic, tx, el('span', 'q-sec', where));
  }
  r.onmousedown = e => e.preventDefault();          // не терять фокус строки
  r.onmousemove = () => { if (qSel !== i) { qSel = i; paintSel(); } };
  r.onclick = e => activate(i, e.ctrlKey || e.metaKey || e.button === 1);
  return r;
}
function paintSel() { [...qList.children].forEach((r, i) => r.classList.toggle('on', i === qSel)); }

function updateSearch() {
  const q = qInput.value.trim(), ql = q.toLowerCase();
  qForm.classList.toggle('has-q', !!q);
  markTiles(ql);
  if (!q) { qItems = []; qList.hidden = true; return; }
  qItems = [{ kind: 'web', q, open: looksLikeUrl(q) }, ...findBookmarks(ql).map(x => ({ kind: 'bm', ...x }))];
  qSel = 0;
  qList.innerHTML = '';
  qItems.forEach((it, i) => qList.append(rowEl(it, i)));
  qList.hidden = document.activeElement !== qInput;
}

function activate(i, newTab) {
  const it = qItems[i];
  if (!it) return;
  const url = it.kind === 'web' ? (it.open ? normalizeUrl(it.q) : GOOGLE(it.q)) : it.t.url;
  if (newTab) { chrome.tabs.create({ url, active: false }); return; }
  qList.hidden = true;
  if (it.kind === 'bm') {
    // если плитка видна на странице — открываем с анимацией темы прямо с неё
    const a = [...root.querySelectorAll('a.item')].find(x => x.getAttribute('href') === it.t.url && x.offsetParent);
    if (a) return openTile(a, it.t, {});
  }
  const box = qForm.querySelector('.sbox'), r = box.getBoundingClientRect();
  openTile(box, { url }, { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
}

qInput.addEventListener('input', updateSearch);
qInput.addEventListener('focus', () => { qForm.classList.add('focus'); if (qItems.length) qList.hidden = false; });
qInput.addEventListener('blur', () => { qForm.classList.remove('focus'); qList.hidden = true; });
qInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!qItems.length) return;
    e.preventDefault();
    qSel = (qSel + (e.key === 'ArrowDown' ? 1 : -1) + qItems.length) % qItems.length;
    paintSel();
  } else if (e.key === 'Escape') {
    e.stopPropagation();
    if (qInput.value) { qInput.value = ''; updateSearch(); } else qInput.blur();
  }
});
qForm.addEventListener('submit', e => e.preventDefault());
qInput.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.isComposing) return;
  e.preventDefault();
  if (qInput.value.trim()) activate(qSel, e.ctrlKey || e.metaKey);   // Ctrl+Enter — в новой вкладке
});

// начать печатать в любом месте страницы — текст сразу идёт в поиск; «/» просто ставит курсор
document.addEventListener('keydown', e => {
  if (!S.search || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
  if (document.activeElement === qInput || $('editDlg').open || $('panel').classList.contains('open')) return;
  const tg = e.target;
  if (tg.closest && tg.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
  if (e.key === '/') { e.preventDefault(); qInput.focus(); return; }
  if (e.key.length === 1 && e.key !== ' ') qInput.focus();   // сам символ браузер допечатает уже в строку
});

// после перерисовки панели подсветка должна остаться
const _render = render;
render = function () { _render(); if (qInput.value.trim()) markTiles(qInput.value.trim().toLowerCase()); };

addEventListener('pageshow', ev => {
  if (!ev.persisted) return;
  qForm.querySelector('.sbox').style.visibility = '';
  qInput.value = ''; updateSearch();
});

const IC_Q = {
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  globe: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'
};
