const THEMES = {
  neon:  { accent: '#fa1e4e', tile: '#16131e', bg: '#0b0a10', text: '#ece9f5', radius: 14 },
  glass: { accent: '#ffb38a', tile: '#1c1733', bg: '#0e1430', text: '#f6f3ff', radius: 20 },
  calm:  { accent: '#d4ff4f', tile: '#1a1a1c', bg: '#0f0f11', text: '#ededea', radius: 12 },
  cards: { accent: '#d4af37', tile: '#15130f', bg: '#0a0908', text: '#efe6cf', radius: 10 }
};
const DEFAULTS = {
  theme: 'neon',
  cols: 5, w: 200, h: 116, gap: 20, radius: 14, fav: 20, font: 14, top: 110, secGap: 24,
  showTitles: true, ...THEMES.neon,
  dim: 30, blur: 0, anim: true, fxv: { neon: 0, glass: 0, calm: 0, cards: 0 }, replaceStart: true, view: 'list', panels: true, active: null
};
const SIZE_KEYS = ['cols', 'w', 'h', 'gap', 'radius', 'fav', 'font', 'top', 'secGap'];
const PX_KEYS = ['w', 'h', 'gap', 'radius', 'fav', 'font', 'top', 'blur', 'secGap'];
const COLOR_KEYS = ['bg', 'tile', 'accent', 'text'];
const DEFAULT_TILES = [
  { title: 'YouTube', url: 'https://www.youtube.com/' },
  { title: 'Google', url: 'https://www.google.com/' },
  { title: 'Википедия', url: 'https://ru.wikipedia.org/' },
  { title: 'GitHub', url: 'https://github.com/' }
];

// иконки (статичные строки)
const IC = {
  grip: '<svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor"><circle cx="3" cy="3" r="1.6"/><circle cx="9" cy="3" r="1.6"/><circle cx="3" cy="9" r="1.6"/><circle cx="9" cy="9" r="1.6"/><circle cx="3" cy="15" r="1.6"/><circle cx="9" cy="15" r="1.6"/></svg>',
  chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  pen: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"><path d="M16 3l5 5L8 21H3v-5z"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  x: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  folder: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>',
  down: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v14M6 12l6 6 6-6"/></svg>'
};

const $ = id => document.getElementById(id);
const root = $('root');
let S = { ...DEFAULTS };
let sections = [];
let bgImage = null;
let drag = null;          // { type: 'tile', sec, folder, idx, isFolder } или { type: 'sec', id }
let editLoc = null;       // где лежит редактируемая плитка: { sec, folder }
const openFolders = new Set();   // открытые папки (по одной на раздел)
let editIndex = -1;
let draftImage = null;
let lastInd = null;       // прошлое положение индикатора вкладок — для плавного переезда

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const secById = id => sections.find(s => s.id === id);
const isFolder = t => t && t.type === 'folder';
function folderById(s, id) { return s && id ? s.tiles.find(t => isFolder(t) && t.id === id) : null; }
// список плиток раздела или папки внутри него
function getList(secId, folderId) {
  const s = secById(secId);
  if (!s) return null;
  if (!folderId) return s.tiles;
  const f = folderById(s, folderId);
  return f ? f.tiles : null;
}
// все ссылки раздела, включая лежащие в папках
const linksOf = s => s.tiles.flatMap(t => isFolder(t) ? t.tiles : [t]);

// ---------- хранение ----------
async function load() {
  const data = await chrome.storage.local.get(['settings', 'sections', 'tiles', 'bgImage']);
  S = { ...DEFAULTS, ...(data.settings || {}) };
  if (!THEMES[S.theme]) S.theme = 'neon';
  S.fxv = { ...DEFAULTS.fxv, ...(S.fxv || {}) };
  // тема «Карты» стала чёрно-золотой: старые цвета этой темы меняем на новые
  if (S.theme === 'cards' && S.accent === '#c62f3b' && S.tile === '#f5f0e3' && S.bg === '#0e1630') Object.assign(S, THEMES.cards);
  if (Array.isArray(data.sections)) {
    sections = data.sections;
  } else {
    sections = [{ id: uid(), name: 'Основное', collapsed: false, tiles: data.tiles || DEFAULT_TILES.slice() }];
    await chrome.storage.local.set({ sections });
    if (data.tiles) chrome.storage.local.remove('tiles');
  }
  bgImage = data.bgImage || null;
  applySettings();
  applyBg();
  fillForm();
  render();
  setTimeout(() => document.body.classList.remove('intro'), 1400);
}
function saveSettings() { chrome.storage.local.set({ settings: S }); }
function saveSections() { chrome.storage.local.set({ sections }); }

// ---------- картинки ----------
function readAsDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
async function fileToDataUrl(file, maxSide) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.9);
  } catch {
    return readAsDataUrl(file);
  }
}
const cssUrl = u => `url("${u.replace(/"/g, '%22')}")`;

// ---------- внешний вид ----------
function applySettings() {
  const r = document.documentElement.style;
  r.setProperty('--cols', S.cols);
  for (const k of PX_KEYS) r.setProperty('--' + k, S[k] + 'px');
  for (const k of COLOR_KEYS) r.setProperty('--' + k, S[k]);
  r.setProperty('--dim', S.dim / 100);
  const b = document.body;
  b.dataset.theme = S.theme;
  b.classList.toggle('no-titles', !S.showTitles);
  b.classList.toggle('no-panels', !S.panels);
  b.classList.toggle('view-tabs', S.view === 'tabs');
  document.querySelectorAll('.theme-btn').forEach(x => x.classList.toggle('on', x.dataset.themePick === S.theme));
  document.querySelectorAll('[data-seg="view"] button').forEach(x => x.classList.toggle('on', x.dataset.val === S.view));
  syncFx();
}
const FX_NAMES = { neon: ['Горизонт', 'Соты', 'Гиперпрыжок'], glass: ['Пятна', 'Шёлк'], calm: ['Точки', 'Созвездия'], cards: ['Полёт', 'Масти', 'Веер'] };
function syncFx() {
  const on = !!S.anim && !bgImage;
  const names = FX_NAMES[S.theme];
  const v = Math.min(S.fxv[S.theme] || 0, names.length - 1);
  document.body.classList.toggle('fx-on', on);
  // кнопок столько, сколько фонов у темы
  const seg = document.querySelector('[data-seg="fxv"]');
  if (seg.children.length !== names.length) {
    seg.innerHTML = '';
    names.forEach((_, i) => { const b = el('button'); b.type = 'button'; b.dataset.val = i; seg.append(b); });
    seg.style.gridTemplateColumns = `repeat(${names.length}, 1fr)`;
  }
  [...seg.children].forEach(b => {
    b.textContent = names[+b.dataset.val];
    b.classList.toggle('on', +b.dataset.val === v);
  });
  if (window.FX) FX.set(S.theme, on, v);
}
function applyBg() {
  $('bg').style.backgroundImage = bgImage ? cssUrl(bgImage) : '';
  document.body.classList.toggle('has-bg', !!bgImage);
  $('bgThumb').style.backgroundImage = bgImage ? cssUrl(bgImage) : '';
  syncFx();
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
function faviconUrl(pageUrl, px) {
  const size = Math.min(256, Math.max(16, (px || S.fav) * 2));
  return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`);
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function iconBtn(cls, icon, label, text) {
  const b = el('button', cls);
  b.type = 'button';
  b.innerHTML = icon;
  if (text) b.append(el('span', '', text));
  b.setAttribute('aria-label', label);
  b.title = label;
  return b;
}
function placeholder(t) { return el('div', 'ph', hostOf(t.url)); }
function letterEl(t) { return el('div', 'letter', (t.title || hostOf(t.url)).charAt(0).toUpperCase()); }
function favEl(t, px) {
  const img = el('img');
  img.src = faviconUrl(t.url, px);
  img.alt = '';
  img.draggable = false;
  img.onerror = () => img.replaceWith(letterEl(t));
  return img;
}

// ---------- перетаскивание ----------
function clearMarks() {
  document.querySelectorAll('.peek').forEach(e => e.remove());
  document.querySelectorAll('.over, .into, .drop-before, .drop-after, .drop-into')
    .forEach(e => e.classList.remove('over', 'into', 'drop-before', 'drop-after', 'drop-into'));
}
function endDrag() {
  drag = null;
  clearMarks();
  document.querySelectorAll('.dragging').forEach(e => e.classList.remove('dragging'));
}
document.addEventListener('dragover', clearMarks);
document.addEventListener('drop', e => { e.preventDefault(); endDrag(); });

// копия перетаскиваемой плитки «заглядывает» в место, куда встанет (тема «Тишина»)
function addPeek(target) {
  const src = document.querySelector('.item.dragging .card');
  if (!src) return;
  const media = src.querySelector('img.cover, .ph, .fgrid');
  const p = el('div', 'peek');
  if (media) {
    const c = media.cloneNode(true);
    if (c.tagName === 'IMG') c.style.objectFit = media.style.objectFit;
    p.append(c);
  }
  target.querySelector('.card').append(p);
}

// d — что тащим ({ sec, folder, idx, isFolder }), куда — раздел/папка и позиция
function moveItem(d, toSec, toFolder, toIdx, exact) {
  const from = getList(d.sec, d.folder), to = getList(toSec, toFolder);
  if (!from || !to) return;
  if (d.isFolder && toFolder) return;                 // папку в папку не кладём
  if (exact && from === to && d.idx === toIdx) return;
  const [t] = from.splice(d.idx, 1);
  if (!exact && from === to && d.idx < toIdx) toIdx--;
  to.splice(Math.min(toIdx, to.length), 0, t);
  saveSections(); render();
}
function moveSection(id, targetId, after) {
  if (id === targetId) return;
  const from = sections.findIndex(s => s.id === id);
  const [s] = sections.splice(from, 1);
  let to = sections.findIndex(x => x.id === targetId);
  if (after) to++;
  sections.splice(to, 0, s);
  saveSections(); render();
}
const isAfter = (e, node, horizontal) => {
  const r = node.getBoundingClientRect();
  return horizontal ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
};

// ---------- плитка ----------
function tileEl(loc, t, i) {
  const a = el('a', 'item');
  a.href = t.url;
  a.title = t.url;
  a.draggable = true;

  a.append(el('span', 'ring'), el('span', 'ring'));

  const card = el('div', 'card');
  if (t.image) {
    const img = el('img', 'cover');
    img.src = t.image;
    img.alt = '';
    img.draggable = false;
    img.style.objectFit = t.fit || 'cover';
    img.onerror = () => img.replaceWith(placeholder(t));
    card.append(img);
  } else {
    card.append(placeholder(t));
  }

  const drop = el('span', 'drop-label');
  drop.innerHTML = IC.down;
  drop.append(el('span', 'dl'));
  card.append(drop);

  const tools = el('div', 'tools');
  const edit = iconBtn('', IC.pen, 'Изменить');
  edit.onclick = e => { e.preventDefault(); openEditor(loc, i); };
  const del = iconBtn('', IC.x, 'Удалить');
  del.onclick = e => {
    e.preventDefault();
    if (confirm(`Удалить «${t.title || hostOf(t.url)}»?`)) { getList(loc.sec, loc.folder).splice(i, 1); saveSections(); render(); }
  };
  tools.append(edit, del);
  card.append(tools);
  a.append(card);

  const cap = el('div', 'caption');
  cap.append(favEl(t), el('span', 'name', t.title || hostOf(t.url)), el('span', 'host-s', hostOf(t.url)));
  a.append(cap);

  a.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (e.target.closest('.tools')) return;
    e.preventDefault();
    openTile(a, t, e);
  });

  a.addEventListener('dragstart', e => {
    drag = { type: 'tile', sec: loc.sec, folder: loc.folder, idx: i, isFolder: false };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', t.url);
    requestAnimationFrame(() => a.classList.add('dragging'));
  });
  a.addEventListener('dragend', endDrag);
  a.addEventListener('dragover', e => {
    if (!drag || drag.type !== 'tile') return;
    e.stopPropagation();
    if (drag.isFolder && loc.folder) { clearMarks(); return; }   // папку в папку нельзя
    e.preventDefault();
    if (drag.sec === loc.sec && drag.folder === loc.folder && drag.idx === i) { clearMarks(); return; }
    if (a.classList.contains('over')) return;
    clearMarks();
    a.classList.add('over');
    addPeek(a);
  });
  a.addEventListener('drop', e => {
    if (!drag || drag.type !== 'tile') return;
    e.preventDefault(); e.stopPropagation();
    const d = drag;
    endDrag();
    moveItem(d, loc.sec, loc.folder, i, true);
  });
  return a;
}

// ---------- папка ----------
function folderThumbs(f) {
  const g = el('div', 'fgrid');
  if (!f.tiles.length) {
    const empty = el('div', 'fempty');
    empty.innerHTML = IC.folder;
    g.append(empty);
    return g;
  }
  f.tiles.slice(0, 4).forEach(t => {
    const c = el('div', 'fcell');
    if (t.image) {
      const img = el('img', 'thumb');
      img.src = t.image; img.alt = ''; img.draggable = false;
      img.onerror = () => img.replaceWith(favEl(t, 22));
      c.append(img);
    } else {
      const fi = favEl(t, 22);
      fi.classList.add('fi');
      c.append(fi);
    }
    g.append(c);
  });
  return g;
}

function folderTileEl(s, f, i) {
  const open = openFolders.has(f.id);
  const item = el('div', 'item folder' + (open ? ' open' : ''));
  item.draggable = true;
  item.append(el('span', 'ring'), el('span', 'ring'));

  // внутри лежат кнопки ✎ и ✕, поэтому сама карточка — не <button>, а фокусируемый блок
  const card = el('div', 'card');
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-expanded', open);
  card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFolder(s, f); } };
  card.setAttribute('aria-label', `Папка «${f.name}», закладок: ${f.tiles.length}`);
  card.append(folderThumbs(f));
  const drop = el('span', 'drop-label');
  drop.innerHTML = IC.down;
  drop.append(el('span', 'dl'));
  card.append(drop);
  card.onclick = () => toggleFolder(s, f);

  const tools = el('div', 'tools');
  const ren = iconBtn('', IC.pen, 'Переименовать папку');
  ren.onclick = e => { e.stopPropagation(); openFolder(s, f); render(); renameOpenFolder(f); };
  const del = iconBtn('', IC.x, 'Удалить папку');
  del.onclick = e => { e.stopPropagation(); deleteFolder(s, f); };
  tools.append(ren, del);
  card.append(tools);
  item.append(card);

  const cap = el('div', 'caption');
  const ic = el('span', 'ficon');
  ic.innerHTML = IC.folder;
  cap.append(ic, el('span', 'name', f.name), el('span', 'fcount', f.tiles.length));
  item.append(cap);

  item.addEventListener('dragstart', e => {
    drag = { type: 'tile', sec: s.id, folder: null, idx: i, isFolder: true };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', f.name);
    requestAnimationFrame(() => item.classList.add('dragging'));
  });
  item.addEventListener('dragend', endDrag);
  item.addEventListener('dragover', e => {
    if (!drag || drag.type !== 'tile') return;
    e.preventDefault(); e.stopPropagation();
    if (drag.isFolder) {
      // папку тащат по папке — просто меняем порядок
      if (drag.sec === s.id && drag.idx === i) { clearMarks(); return; }
      if (item.classList.contains('over')) return;
      clearMarks(); item.classList.add('over'); addPeek(item);
    } else {
      if (drag.sec === s.id && drag.folder === f.id) { clearMarks(); return; }
      if (item.classList.contains('into')) return;
      clearMarks(); item.classList.add('into');
    }
  });
  item.addEventListener('drop', e => {
    if (!drag || drag.type !== 'tile') return;
    e.preventDefault(); e.stopPropagation();
    const d = drag;
    endDrag();
    if (d.isFolder) moveItem(d, s.id, null, i, true);
    else if (!(d.sec === s.id && d.folder === f.id)) moveItem(d, s.id, f.id, f.tiles.length);
  });
  return item;
}

// раскрытая папка — вставляется в сетку сразу под рядом, где стоит папка
function folderPanelEl(s, f, col) {
  const box = el('div', 'folder-open');
  box.dataset.folder = f.id;
  box.style.setProperty('--nx', `calc(${col} * (var(--w) + var(--gap)) + var(--w) / 2)`);

  const head = el('div', 'fo-head');
  const ic = el('span', 'ficon');
  ic.innerHTML = IC.folder;
  const title = el('h3', 'fo-title', f.name);
  title.title = 'Дважды щёлкните, чтобы переименовать';
  title.ondblclick = () => startRename(title, f);
  const count = el('span', 'count', f.tiles.length);
  const line = el('div', 'sec-line');
  const tools = el('div', 'fo-tools');
  const add = iconBtn('st st-add', IC.plus, 'Добавить закладку в папку', 'Закладка');
  add.onclick = () => openEditor({ sec: s.id, folder: f.id }, -1);
  const ren = iconBtn('st st-ren', IC.pen, 'Переименовать папку', 'Переименовать');
  ren.onclick = () => startRename(title, f);
  const del = iconBtn('st st-del', IC.trash, 'Удалить папку', 'Удалить');
  del.onclick = () => deleteFolder(s, f);
  const close = iconBtn('fo-close', IC.x, 'Закрыть папку');
  close.onclick = () => { openFolders.delete(f.id); render(); };
  tools.append(add, ren, del, close);
  head.append(ic, title, count, line, tools);
  box.append(head);

  const grid = el('div', 'fo-grid');
  const loc = { sec: s.id, folder: f.id };
  f.tiles.forEach((t, i) => grid.append(tileEl(loc, t, i)));
  const addWrap = el('div', 'item add-wrap');
  const addCard = el('button', 'card add');
  addCard.type = 'button';
  addCard.innerHTML = IC.plus;
  addCard.append(el('span', '', 'Добавить'));
  addCard.setAttribute('aria-label', 'Добавить закладку в папку');
  addCard.onclick = () => openEditor(loc, -1);
  addWrap.append(addCard);
  grid.append(addWrap);
  box.append(grid);

  box.addEventListener('dragover', e => {
    if (!drag || drag.type !== 'tile' || drag.isFolder) return;
    e.preventDefault(); e.stopPropagation();
    if (box.classList.contains('drop-into')) return;
    clearMarks(); box.classList.add('drop-into');
  });
  box.addEventListener('drop', e => {
    if (!drag || drag.type !== 'tile' || drag.isFolder) return;
    e.preventDefault(); e.stopPropagation();
    const d = drag;
    endDrag();
    moveItem(d, s.id, f.id, f.tiles.length);
  });
  return box;
}

function openFolder(s, f) {
  s.tiles.forEach(t => { if (isFolder(t)) openFolders.delete(t.id); });
  openFolders.add(f.id);
  s.collapsed = false;
}
function toggleFolder(s, f) {
  if (openFolders.has(f.id)) openFolders.delete(f.id);
  else openFolder(s, f);
  render();
}
function renameOpenFolder(f) {
  const title = root.querySelector(`.folder-open[data-folder="${f.id}"] .fo-title`);
  if (title) startRename(title, f);
}
function addFolder(s) {
  const f = { type: 'folder', id: uid(), name: 'Новая папка', tiles: [] };
  s.tiles.push(f);
  openFolder(s, f);
  saveSections(); render();
  renameOpenFolder(f);
}
function deleteFolder(s, f) {
  const n = f.tiles.length;
  const msg = n ? `Удалить папку «${f.name}»? Закладки из неё (${n} шт.) останутся в разделе.` : `Удалить папку «${f.name}»?`;
  if (!confirm(msg)) return;
  const idx = s.tiles.indexOf(f);
  s.tiles.splice(idx, 1, ...f.tiles);
  openFolders.delete(f.id);
  saveSections(); render();
}

// ---------- анимация открытия сайта (своя у каждой темы) ----------
let opening = false;
function openTile(a, t, e) {
  if (opening) return;
  const go = () => { location.href = t.url; };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return go();
  opening = true;
  const W = innerWidth, H = innerHeight;
  const ease = 'cubic-bezier(.2,.9,.2,1)';

  if (S.theme === 'neon') {
    a.classList.add('glitching');
    const ov = el('div', 'fx-open neon');
    for (let k = 0; k < 9; k++) {
      const strip = el('i');
      strip.style.animationDelay = (90 + Math.random() * 110) + 'ms';
      ov.append(strip);
    }
    const msg = el('div', 'fx-msg', '> ' + hostOf(t.url));
    msg.append(el('b', '', '_'));
    ov.append(msg);
    document.body.append(ov);
    setTimeout(go, 520);
  } else if (S.theme === 'glass') {
    const card = a.querySelector('.card');
    const r = card.getBoundingClientRect();
    const ov = el('div', 'fx-open glass');
    const media = card.querySelector('img.cover, .ph');
    if (media) {
      const c = media.cloneNode(true);
      if (c.tagName === 'IMG') c.style.objectFit = 'cover';
      ov.append(c);
    }
    const rad = getComputedStyle(card).borderRadius;
    Object.assign(ov.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: rad });
    document.body.append(ov);
    card.style.visibility = 'hidden';
    ov.animate(
      [{ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: rad },
       { left: '0px', top: '0px', width: W + 'px', height: H + 'px', borderRadius: '0px' }],
      { duration: 480, easing: ease, fill: 'forwards' });
    if (media) ov.firstChild.animate([{ filter: 'blur(0)', transform: 'scale(1)' }, { filter: 'blur(14px)', transform: 'scale(1.15)' }], { duration: 480, easing: ease, fill: 'forwards' });
    root.animate([{ filter: 'blur(0)', transform: getComputedStyle(root).transform === 'none' ? 'scale(1)' : getComputedStyle(root).transform }, { filter: 'blur(10px)', transform: 'scale(.94)' }], { duration: 480, easing: ease, fill: 'forwards' });
    setTimeout(go, 470);
  } else if (S.theme === 'cards') {
    // карта переворачивается рубашкой вверх и раскрывается на весь экран
    const card = a.querySelector('.card');
    const r = card.getBoundingClientRect();
    const rad = getComputedStyle(card).borderRadius;
    const ov = el('div', 'fx-open cards');
    const flip = el('div', 'flip');
    const front = el('div', 'face front');
    const media = card.querySelector('img.cover, .ph');
    if (media) {
      const c = media.cloneNode(true);
      if (c.tagName === 'IMG') c.style.objectFit = media.style.objectFit || 'cover';
      front.append(c);
    }
    flip.append(front, el('div', 'face back'));
    ov.append(flip);
    document.body.append(ov);
    card.style.visibility = 'hidden';
    const at = (x, y, w, h, extra) => Object.assign({ left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', borderRadius: rad }, extra);
    flip.animate([
      at(r.left, r.top, r.width, r.height, { transform: 'rotateY(0deg)' }),
      at(r.left - r.width * .05, r.top - r.height * .1, r.width * 1.1, r.height * 1.1, { transform: 'rotateY(180deg)', offset: .5 }),
      at(0, 0, W, H, { transform: 'rotateY(180deg)', borderRadius: '0px' })
    ], { duration: 720, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
    setTimeout(go, 700);
  } else {
    const x = e.clientX || W / 2, y = e.clientY || H / 2;
    const R = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) * 2;
    const ring = (cls, delay) => {
      const c = el('div', 'fx-open calm ' + cls);
      Object.assign(c.style, { left: x + 'px', top: y + 'px', width: R + 'px', height: R + 'px' });
      document.body.append(c);
      c.animate([{ transform: 'translate(-50%,-50%) scale(0)' }, { transform: 'translate(-50%,-50%) scale(1)' }],
        { duration: 520, delay, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'both' });
    };
    ring('ink', 0);
    ring('paper', 110);
    setTimeout(go, 560);
  }
}
// при возврате кнопкой «Назад» страница может восстановиться из кэша — убираем следы анимации
addEventListener('pageshow', ev => {
  if (!ev.persisted) return;
  opening = false;
  document.querySelectorAll('.fx-open').forEach(x => x.remove());
  root.getAnimations().forEach(x => x.cancel());
  render();
});

// ---------- раздел ----------
function sectionEl(s, n) {
  const tabs = S.view === 'tabs';
  const box = el('section', 'section' + (s.collapsed && !tabs ? ' collapsed' : ''));
  box.dataset.id = s.id;
  // в режиме вкладок раздел появляется вместе с полосой вкладок; в списке — лёгкая очередь, не больше 4 шагов
  box.style.setProperty('--i', tabs ? 0 : Math.min(n, 4));

  const head = el('div', 'sec-head');

  const handle = el('span', 'handle');
  handle.innerHTML = IC.grip;
  handle.title = 'Перетащите, чтобы поменять порядок разделов';
  handle.draggable = true;
  handle.addEventListener('dragstart', e => {
    drag = { type: 'sec', id: s.id };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', s.name);
    e.dataTransfer.setDragImage(head, 20, 18);
    requestAnimationFrame(() => box.classList.add('dragging'));
  });
  handle.addEventListener('dragend', endDrag);

  const chev = iconBtn('chev', IC.chev, s.collapsed ? 'Развернуть раздел' : 'Свернуть раздел');
  chev.onclick = () => { s.collapsed = !s.collapsed; saveSections(); render(); };

  const num = el('span', 'sec-num', String(n + 1).padStart(2, '0'));

  const title = el('h2', 'sec-title', s.name);
  title.title = 'Дважды щёлкните, чтобы переименовать';
  title.ondblclick = () => startRename(title, s);

  const count = el('span', 'count', linksOf(s).length);

  const mini = el('div', 'sec-mini');
  linksOf(s).slice(0, 6).forEach(t => mini.append(favEl(t, 22)));

  const line = el('div', 'sec-line');

  const tools = el('div', 'sec-tools');
  const add = iconBtn('st st-add', IC.plus, 'Добавить закладку', 'Закладка');
  add.onclick = () => openEditor({ sec: s.id, folder: null }, -1);
  const fold = iconBtn('st st-fold', IC.folder, 'Новая папка', 'Папка');
  fold.onclick = () => addFolder(s);
  const ren = iconBtn('st st-ren', IC.pen, 'Переименовать раздел', 'Переименовать');
  ren.onclick = () => startRename(title, s);
  const del = iconBtn('st st-del', IC.trash, 'Удалить раздел', 'Удалить');
  del.onclick = () => deleteSection(s);
  tools.append(add, fold, ren, del);

  head.append(handle, chev, num, title, count, mini, line, tools);
  box.append(head);

  const grid = el('div', 'grid');
  const loc = { sec: s.id, folder: null };
  const nodes = s.tiles.map((t, i) => isFolder(t) ? folderTileEl(s, t, i) : tileEl(loc, t, i));
  const addWrap = el('div', 'item add-wrap');
  const addCard = el('button', 'card add');
  addCard.type = 'button';
  addCard.innerHTML = IC.plus;
  addCard.append(el('span', '', 'Добавить'));
  addCard.setAttribute('aria-label', 'Добавить закладку в этот раздел');
  addCard.onclick = () => openEditor(loc, -1);
  addWrap.append(addCard);
  nodes.push(addWrap);
  const openIdx = s.tiles.findIndex(t => isFolder(t) && openFolders.has(t.id));
  if (openIdx >= 0) {
    const cols = Math.max(1, S.cols);
    const rowEnd = Math.min((Math.floor(openIdx / cols) + 1) * cols, nodes.length);
    nodes.splice(rowEnd, 0, folderPanelEl(s, s.tiles[openIdx], openIdx % cols));
  }
  grid.append(...nodes);
  box.append(grid);

  box.addEventListener('dragover', e => {
    if (!drag || (drag.type === 'sec' && (drag.id === s.id || tabs))) return;
    e.preventDefault(); e.stopPropagation();
    clearMarks();
    if (drag.type === 'sec') box.classList.add(isAfter(e, box) ? 'drop-after' : 'drop-before');
    else box.classList.add('drop-into');
  });
  box.addEventListener('drop', e => {
    if (!drag) return;
    e.preventDefault(); e.stopPropagation();
    const d = drag;
    const after = isAfter(e, box);
    endDrag();
    if (d.type === 'tile') moveItem(d, s.id, null, s.tiles.length);
    else if (!tabs) moveSection(d.id, s.id, after);
  });
  return box;
}

function tabBar() {
  const bar = el('nav', 'tabs');
  bar.setAttribute('aria-label', 'Разделы');
  bar.append(el('span', 'tab-ind'));
  sections.forEach((s, n) => {
    const b = el('button', 'tab' + (s.id === S.active ? ' on' : ''));
    b.type = 'button';
    b.append(el('span', 'tab-num', String(n + 1).padStart(2, '0')), el('span', 'tab-name', s.name), el('span', 'count', linksOf(s).length));
    b.onclick = () => { if (S.active !== s.id) { S.active = s.id; saveSettings(); render(); } };
    b.draggable = true;
    b.addEventListener('dragstart', e => {
      drag = { type: 'sec', id: s.id };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', s.name);
      requestAnimationFrame(() => b.classList.add('dragging'));
    });
    b.addEventListener('dragend', endDrag);
    b.addEventListener('dragover', e => {
      if (!drag || (drag.type === 'sec' && drag.id === s.id)) return;
      e.preventDefault(); e.stopPropagation();
      clearMarks();
      if (drag.type === 'tile') b.classList.add('drop-into');
      else b.classList.add(isAfter(e, b, true) ? 'drop-after' : 'drop-before');
    });
    b.addEventListener('drop', e => {
      if (!drag) return;
      e.preventDefault(); e.stopPropagation();
      const d = drag;
      const after = isAfter(e, b, true);
      endDrag();
      if (d.type === 'tile') moveItem(d, s.id, null, s.tiles.length);
      else moveSection(d.id, s.id, after);
    });
    bar.append(b);
  });
  const add = el('button', 'tab add', '+ Раздел');
  add.type = 'button';
  add.title = 'Новый раздел';
  add.onclick = addSection;
  bar.append(add);
  return bar;
}

// индикатор активной вкладки переезжает с прошлого места на новое
let indObserver = null;
function placeIndicator(instant) {
  const bar = root.querySelector('.tabs');
  if (!bar) { lastInd = null; if (indObserver) indObserver.disconnect(); return; }
  const ind = bar.querySelector('.tab-ind');
  const on = bar.querySelector('.tab.on');
  if (!on) { ind.style.width = '0'; return; }
  const pos = { left: on.offsetLeft, top: on.offsetTop, width: on.offsetWidth, height: on.offsetHeight };
  const set = p => Object.assign(ind.style, { left: p.left + 'px', top: p.top + 'px', width: p.width + 'px', height: p.height + 'px' });
  if (instant) {
    // перемер без анимации — подсветка просто встаёт точно на место
    ind.style.transition = 'none';
    set(pos);
    ind.getBoundingClientRect();
    ind.style.transition = '';
  } else {
    if (lastInd) {
      ind.style.transition = 'none';
      set(lastInd);
      ind.getBoundingClientRect();
      ind.style.transition = '';
    }
    set(pos);
  }
  lastInd = pos;
  // вкладки могут поменять размер позже (догрузился шрифт, сменилось окно) — следим и поправляем
  if (indObserver) indObserver.disconnect();
  indObserver = new ResizeObserver(() => {
    const p = { left: on.offsetLeft, top: on.offsetTop, width: on.offsetWidth, height: on.offsetHeight };
    if (lastInd && p.left === lastInd.left && p.top === lastInd.top && p.width === lastInd.width && p.height === lastInd.height) return;
    placeIndicator(true);
  });
  indObserver.observe(bar);
  bar.querySelectorAll('.tab').forEach(x => indObserver.observe(x));
}

function render() {
  root.innerHTML = '';
  if (S.view === 'tabs') {
    if (!secById(S.active)) S.active = sections[0] ? sections[0].id : null;
    root.append(tabBar());
    const n = sections.findIndex(s => s.id === S.active);
    if (n >= 0) root.append(sectionEl(sections[n], n));
    placeIndicator();
  } else {
    lastInd = null;
    sections.forEach((s, n) => root.append(sectionEl(s, n)));
    const add = el('button', 'new-section');
    add.type = 'button';
    add.innerHTML = IC.plus;
    add.append(el('span', '', 'Новый раздел'));
    add.style.setProperty('--i', Math.min(sections.length, 5));
    add.onclick = addSection;
    root.append(add);
  }
}
window.addEventListener('resize', () => { if (S.view === 'tabs') placeIndicator(true); });
document.fonts && document.fonts.ready.then(() => { if (S.view === 'tabs') placeIndicator(true); });
document.fonts && document.fonts.addEventListener('loadingdone', () => { if (S.view === 'tabs') placeIndicator(true); });
// вкладку могли подготовить в фоне — при показе перемеряем
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.view === 'tabs') placeIndicator(true); });

// ---------- действия с разделами ----------
function startRename(title, s) {
  title.contentEditable = 'true';
  title.focus();
  document.getSelection().selectAllChildren(title);
  const finish = save => {
    title.contentEditable = 'false';
    title.onblur = title.onkeydown = null;
    const name = title.textContent.trim();
    if (save && name) s.name = name;
    saveSections(); render();
  };
  title.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') finish(false);
  };
  title.onblur = () => finish(true);
}
function addSection() {
  const s = { id: uid(), name: 'Новый раздел', collapsed: false, tiles: [] };
  sections.push(s);
  if (S.view === 'tabs') { S.active = s.id; saveSettings(); }
  saveSections(); render();
  const title = root.querySelector(`[data-id="${s.id}"] .sec-title`);
  if (title) { title.scrollIntoView({ block: 'center' }); startRename(title, s); }
}
function deleteSection(s) {
  const n = linksOf(s).length;
  const msg = n ? `Удалить раздел «${s.name}» вместе с закладками (${n} шт.)?` : `Удалить раздел «${s.name}»?`;
  if (!confirm(msg)) return;
  sections = sections.filter(x => x !== s);
  saveSections(); render();
}

// ---------- редактор закладки ----------
function normalizeUrl(u) {
  u = u.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  return u;
}
function setPreview() {
  const p = $('imgPreview');
  p.innerHTML = '';
  if (draftImage) {
    const img = el('img');
    img.src = draftImage;
    img.style.objectFit = $('fFit').value;
    img.onerror = () => { p.textContent = 'Не удалось загрузить картинку по ссылке'; };
    p.append(img);
  } else {
    p.textContent = 'Нет изображения — на плитке будет адрес сайта';
  }
}
function openEditor(loc, i) {
  if (!sections.length) sections.push({ id: uid(), name: 'Основное', collapsed: false, tiles: [] });
  if (!loc || !getList(loc.sec, loc.folder)) loc = { sec: sections[0].id, folder: null };
  editLoc = loc;
  editIndex = i;
  const t = i < 0 ? null : getList(loc.sec, loc.folder)[i];
  $('editTitle').textContent = t ? 'Изменить закладку' : 'Новая закладка';
  $('fTitle').value = t ? t.title : '';
  $('fUrl').value = t ? t.url : '';
  const sel = $('fSec');
  sel.innerHTML = '';
  sections.forEach(s => {
    const o = el('option', '', s.name);
    o.value = 's:' + s.id;
    sel.append(o);
    s.tiles.filter(isFolder).forEach(f => {
      const fo = el('option', '', '      › ' + f.name);
      fo.value = 'f:' + s.id + ':' + f.id;
      sel.append(fo);
    });
  });
  sel.value = loc.folder ? `f:${loc.sec}:${loc.folder}` : `s:${loc.sec}`;
  draftImage = t && t.image ? t.image : null;
  $('fImgUrl').value = draftImage && !draftImage.startsWith('data:') ? draftImage : '';
  $('fFit').value = t && t.fit ? t.fit : 'cover';
  setPreview();
  $('editDlg').showModal();
}
$('fImgBtn').onclick = () => $('fImgFile').click();
$('fImgFile').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  draftImage = await fileToDataUrl(f, 900);
  $('fImgUrl').value = '';
  e.target.value = '';
  setPreview();
};
$('fImgUrl').oninput = () => { draftImage = $('fImgUrl').value.trim() || null; setPreview(); };
$('fFit').onchange = setPreview;
$('fImgClear').onclick = () => { draftImage = null; $('fImgUrl').value = ''; setPreview(); };

$('editDlg').addEventListener('close', () => {
  if ($('editDlg').returnValue !== 'ok') return;
  const url = normalizeUrl($('fUrl').value);
  try { new URL(url); } catch { alert('Некорректный адрес'); return; }
  const item = { title: $('fTitle').value.trim(), url };
  if (draftImage) { item.image = draftImage; item.fit = $('fFit').value; }
  const [kind, sid, fid] = $('fSec').value.split(':');
  const to = { sec: sid, folder: kind === 'f' ? fid : null };
  const target = getList(to.sec, to.folder) || getList(editLoc.sec, editLoc.folder);
  const source = getList(editLoc.sec, editLoc.folder);
  if (editIndex < 0) {
    target.push(item);
  } else if (target === source) {
    source[editIndex] = item;
  } else {
    source.splice(editIndex, 1);
    target.push(item);
  }
  const ts = secById(to.sec);
  if (ts) {
    ts.collapsed = false;
    if (to.folder) openFolder(ts, folderById(ts, to.folder));
  }
  saveSections(); render();
});

// ---------- панель настроек ----------
function setFill(input) {
  const min = +input.min || 0, max = +input.max || 100;
  input.style.setProperty('--p', ((input.value - min) / (max - min) * 100) + '%');
}
function fillForm() {
  document.querySelectorAll('[data-key]').forEach(e => {
    const k = e.dataset.key;
    if (e.type === 'checkbox') e.checked = !!S[k]; else e.value = S[k];
    if (e.type === 'range') setFill(e);
  });
  $('bgUrl').value = bgImage && !bgImage.startsWith('data:') ? bgImage : '';
  updateOutputs();
}
function updateOutputs() {
  document.querySelectorAll('output[data-for]').forEach(o => {
    const k = o.dataset.for;
    o.textContent = k === 'cols' ? S[k] : k === 'dim' ? S[k] + ' %' : S[k] + ' px';
  });
}
document.querySelectorAll('[data-key]').forEach(e => {
  e.addEventListener('input', () => {
    const k = e.dataset.key;
    if (e.type === 'checkbox') S[k] = e.checked;
    else if (e.type === 'range') { S[k] = Number(e.value); setFill(e); }
    else S[k] = e.value;
    applySettings(); updateOutputs(); saveSettings();
    if (k === 'fav' || ((k === 'w' || k === 'gap' || k === 'font') && S.view === 'tabs')) render();
  });
});

document.querySelectorAll('[data-theme-pick]').forEach(b => {
  b.onclick = () => {
    const t = b.dataset.themePick;
    if (S.theme === t) return;
    S.theme = t;
    Object.assign(S, THEMES[t]);
    lastInd = null;
    applySettings(); fillForm(); saveSettings(); render();
  };
});
document.querySelectorAll('[data-seg="view"] button').forEach(b => {
  b.onclick = () => {
    if (S.view === b.dataset.val) return;
    S.view = b.dataset.val;
    applySettings(); saveSettings(); render();
  };
});

document.querySelector('[data-seg="fxv"]').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  S.fxv = { ...S.fxv, [S.theme]: +b.dataset.val };
  if (!S.anim) { S.anim = true; fillForm(); }
  saveSettings(); syncFx();
});

function openPanel() {
  $('panel').classList.add('open');
  document.body.classList.add('panel-open');
  loadFolders();
}
function closePanel() {
  $('panel').classList.remove('open');
  document.body.classList.remove('panel-open');
}
$('openSettings').onclick = openPanel;
$('closeSettings').onclick = closePanel;
$('scrim').onclick = closePanel;
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || $('editDlg').open) return;
  if ($('panel').classList.contains('open')) closePanel();
  else if (openFolders.size && !document.activeElement.isContentEditable) { openFolders.clear(); render(); }
});

$('resetBtn').onclick = () => {
  for (const k of SIZE_KEYS) S[k] = DEFAULTS[k];
  S.radius = THEMES[S.theme].radius;
  applySettings(); fillForm(); saveSettings(); render();
};

// ---------- запуск Opera сразу с панелью ----------
$('dialUrl').value = chrome.runtime.getURL('newtab.html');
$('dialUrl').onfocus = e => e.target.select();
$('copyUrl').onclick = async () => {
  const btn = $('copyUrl');
  try { await navigator.clipboard.writeText($('dialUrl').value); }
  catch { $('dialUrl').select(); document.execCommand('copy'); }
  btn.textContent = 'Скопировано ✓';
  setTimeout(() => { btn.textContent = 'Копировать'; }, 1600);
};
$('openStartup').onclick = async () => {
  try { await chrome.tabs.create({ url: 'opera://settings/onStartup' }); }
  catch {
    try { await chrome.tabs.create({ url: 'chrome://settings/onStartup' }); }
    catch { $('openStartup').textContent = 'Откройте вручную: opera://settings/onStartup'; }
  }
};

// ---------- фон страницы ----------
function setBg(value) {
  bgImage = value;
  if (value) chrome.storage.local.set({ bgImage: value });
  else chrome.storage.local.remove('bgImage');
  applyBg();
}
$('bgFileBtn').onclick = () => $('bgFile').click();
$('bgFile').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  setBg(await fileToDataUrl(f, 2560));
  $('bgUrl').value = '';
  e.target.value = '';
};
$('bgUrlBtn').onclick = () => {
  const v = $('bgUrl').value.trim();
  if (v) setBg(v);
};
$('bgClear').onclick = () => { setBg(null); $('bgUrl').value = ''; };

// ---------- импорт из закладок ----------
async function loadFolders() {
  const sel = $('folders');
  sel.innerHTML = '';
  const tree = await chrome.bookmarks.getTree();
  const walk = (node, depth) => {
    if (!node.url && node.title) {
      const opt = el('option', '', '— '.repeat(depth) + node.title);
      opt.value = node.id;
      opt.dataset.name = node.title;
      sel.append(opt);
    }
    (node.children || []).forEach(c => walk(c, node.title ? depth + 1 : depth));
  };
  tree.forEach(n => walk(n, 0));
}
$('importBtn').onclick = async () => {
  const opt = $('folders').selectedOptions[0];
  if (!opt) return;
  const [node] = await chrome.bookmarks.getSubTree(opt.value);
  const web = b => b.url && /^https?:/i.test(b.url);
  const deep = n => (n.children || []).flatMap(c => c.url ? [c] : deep(c));   // все ссылки во вложенных папках
  const known = new Set(sections.flatMap(s => linksOf(s).map(t => t.url)));
  let target = sections.find(s => s.name === opt.dataset.name);
  const ensure = () => {
    if (!target) {
      target = { id: uid(), name: opt.dataset.name, collapsed: false, tiles: [] };
      sections.push(target);
    }
    return target;
  };
  let added = 0;
  for (const c of node.children || []) {
    if (c.url) {
      if (!web(c) || known.has(c.url)) continue;
      ensure().tiles.push({ title: c.title, url: c.url });
      known.add(c.url); added++;
    } else {
      // подпапка закладок → папка внутри раздела
      const links = deep(c).filter(b => web(b) && !known.has(b.url));
      if (!links.length) continue;
      let f = ensure().tiles.find(t => isFolder(t) && t.name === c.title);
      if (!f) { f = { type: 'folder', id: uid(), name: c.title || 'Папка', tiles: [] }; target.tiles.push(f); }
      links.forEach(b => { f.tiles.push({ title: b.title, url: b.url }); known.add(b.url); added++; });
    }
  }
  if (added && S.view === 'tabs') { S.active = target.id; saveSettings(); }
  saveSections(); render();
  alert(added ? `Раздел «${target.name}»: добавлено закладок — ${added}` : 'Новых закладок в этой папке нет');
};

load();
