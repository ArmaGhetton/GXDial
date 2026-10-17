// Обложки для плиток без своей картинки.
// Цвет сайта берётся из его значка, узор строится от адреса — у каждого сайта свой и не меняется.
const COVER_STYLES = ['host', 'icon', 'color', 'pattern', 'mono'];
const COVER_NAMES = { host: 'Адрес', icon: 'Значок', color: 'Цвет', pattern: 'Узор', mono: 'Буква' };

const SITE_COLORS_KEY = 'gxSiteColors';
let siteColors = {};
try { siteColors = JSON.parse(localStorage.getItem(SITE_COLORS_KEY) || '{}'); } catch { siteColors = {}; }
const colorJobs = new Map();
let saveColorsTimer = 0;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// самый заметный цвет значка: группируем насыщенные пиксели по оттенку и берём самую весомую группу
function dominantColor(d) {
  const bins = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 160) continue;
    n++;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
    const s = mx ? c / mx : 0;
    if (s < 0.28 || mx < 0.22) continue;
    let h = c === 0 ? 0 : mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
    h = (h * 60 + 360) % 360;
    const w = s * mx, bin = bins[Math.floor(h / 15) % 24];
    bin.w += w; bin.r += d[i] * w; bin.g += d[i + 1] * w; bin.b += d[i + 2] * w;
  }
  const best = bins.reduce((a, b) => (b.w > a.w ? b : a));
  if (!n || best.w < n * 0.04) return null;   // значок чёрно-белый — своего цвета нет
  let [r, g, b] = [best.r / best.w, best.g / best.w, best.b / best.w].map(v => v / 255);
  // слишком тёмный или блёклый цвет немного вытягиваем, чтобы обложка была сочной
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (mx !== mn) {
    const c = mx - mn;
    h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
    h = (h * 60 + 360) % 360;
  }
  l = Math.min(0.62, Math.max(0.42, l));
  s = Math.max(0.55, s);
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

function siteColor(t) {
  const host = hostOf(t.url);
  if (host in siteColors) return Promise.resolve(siteColors[host]);
  if (colorJobs.has(host)) return colorJobs.get(host);
  const job = new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0, 32, 32);
        res(dominantColor(x.getImageData(0, 0, 32, 32).data));
      } catch { res(null); }
    };
    img.onerror = () => res(null);
    img.src = faviconUrl(t.url, 32);
  }).then(col => {
    colorJobs.delete(host);
    if (col) {
      siteColors[host] = col;   // запоминаем только найденные цвета: значок мог ещё не загрузиться
      clearTimeout(saveColorsTimer);
      saveColorsTimer = setTimeout(() => { try { localStorage.setItem(SITE_COLORS_KEY, JSON.stringify(siteColors)); } catch {} }, 500);
    }
    return col;
  });
  colorJobs.set(host, job);
  return job;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, style) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (style) e.setAttribute('style', style);
  return e;
}
// оттенки цвета сайта для узора
const tone = (mix, a) => `fill: color-mix(in srgb, var(--c) ${mix}%, ${mix > 100 ? 'white' : 'var(--tile)'}); fill-opacity: ${a}`;
function shade(r) {
  const k = r();
  if (k < 0.2) return 'fill: color-mix(in srgb, var(--c) 55%, white)';
  if (k < 0.55) return 'fill: var(--c)';
  if (k < 0.8) return 'fill: color-mix(in srgb, var(--c) 55%, var(--tile))';
  return 'fill: color-mix(in srgb, var(--c) 25%, var(--tile))';
}

// узор, у каждого сайта свой
function patternSvg(host) {
  const r = rng(hashStr(host));
  const W = 200, H = 116;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid slice', class: 'cv-art' });
  svg.append(svgEl('rect', { width: W, height: H }, 'fill: color-mix(in srgb, var(--c) 22%, var(--tile))'));
  const kind = Math.floor(r() * 5);
  if (kind === 0) {            // пузыри и кольца
    for (let i = 0; i < 9; i++) {
      const cx = r() * W, cy = r() * H, rad = 8 + r() * 46;
      if (r() < 0.3) svg.append(svgEl('circle', { cx, cy, r: rad, fill: 'none' }, `stroke: color-mix(in srgb, var(--c) 70%, white); stroke-opacity: .55; stroke-width: ${1 + r() * 3}`));
      else svg.append(svgEl('circle', { cx, cy, r: rad }, shade(r) + `; fill-opacity: ${0.35 + r() * 0.5}`));
    }
  } else if (kind === 1) {     // наклонные полосы
    const g = svgEl('g', { transform: `rotate(${-40 + r() * 80} ${W / 2} ${H / 2})` });
    let x = -W;
    while (x < W * 2) {
      const w = 6 + r() * 26;
      if (r() < 0.6) g.append(svgEl('rect', { x, y: -H, width: w, height: H * 3 }, shade(r) + `; fill-opacity: ${0.4 + r() * 0.5}`));
      x += w + r() * 14;
    }
    svg.append(g);
  } else if (kind === 2) {     // треугольная мозаика
    const cols = 8, rows = 5, cw = W / cols * 2, rh = H / rows;
    for (let y = 0; y < rows; y++) for (let x = -1; x < cols; x++) {
      const ox = x * cw / 2 + (y % 2 ? cw / 4 : 0), oy = y * rh;
      const up = (x + y) % 2 === 0;
      const pts = up ? `${ox},${oy + rh} ${ox + cw / 2},${oy} ${ox + cw},${oy + rh}` : `${ox},${oy} ${ox + cw},${oy} ${ox + cw / 2},${oy + rh}`;
      svg.append(svgEl('polygon', { points: pts }, shade(r) + `; fill-opacity: ${0.25 + r() * 0.7}`));
    }
  } else if (kind === 3) {     // волны
    const layers = 4 + Math.floor(r() * 2);
    for (let i = 0; i < layers; i++) {
      const base = H * (0.3 + i * 0.16), amp = 6 + r() * 14, ph = r() * 6.28, fr = 1 + r() * 1.6;
      let d = `M0 ${H}`;
      for (let x = 0; x <= W; x += 8) d += ` L${x} ${(base + Math.sin(x / W * 6.28 * fr + ph) * amp).toFixed(1)}`;
      d += ` L${W} ${H} Z`;
      svg.append(svgEl('path', { d }, tone(i % 2 ? 60 : 100, 0.3 + i * 0.12)));
    }
  } else {                     // плитка из геометрии: четверти кругов, круги, квадраты
    const n = 6, cs = W / n, rows = Math.ceil(H / cs);
    for (let y = 0; y < rows; y++) for (let x = 0; x < n; x++) {
      const px = x * cs, py = y * cs, k = r(), st = shade(r) + `; fill-opacity: ${0.45 + r() * 0.5}`;
      if (k < 0.35) {
        const c = Math.floor(r() * 4), cx = px + (c & 1 ? cs : 0), cy = py + (c & 2 ? cs : 0);
        svg.append(svgEl('path', { d: `M${cx} ${cy} L${cx + (c & 1 ? -cs : cs)} ${cy} A${cs} ${cs} 0 0 ${c === 1 || c === 2 ? 0 : 1} ${cx} ${cy + (c & 2 ? -cs : cs)} Z` }, st));
      } else if (k < 0.6) svg.append(svgEl('circle', { cx: px + cs / 2, cy: py + cs / 2, r: cs * 0.36 }, st));
      else if (k < 0.75) svg.append(svgEl('rect', { x: px + cs * 0.15, y: py + cs * 0.15, width: cs * 0.7, height: cs * 0.7 }, st));
    }
  }
  return svg;
}

// сама обложка; style — один из COVER_STYLES
function coverEl(t, style) {
  const host = hostOf(t.url);
  style = COVER_STYLES.includes(style) ? style : 'host';
  if (style === 'host') return el('div', 'ph', host);

  const box = el('div', 'ph cv cv-' + style);
  const col = siteColors[host];
  if (col) box.style.setProperty('--c', col);
  else siteColor(t).then(c => { if (c) box.style.setProperty('--c', c); });

  if (style === 'icon') {
    const img = el('img', 'cv-ico');
    img.src = faviconUrl(t.url, 64);
    img.alt = ''; img.draggable = false;
    img.onerror = () => img.replaceWith(el('span', 'cv-ico cv-letter', (t.title || host).charAt(0).toUpperCase()));
    box.append(el('span', 'cv-glow'), img, el('span', 'cv-host', host));
  } else if (style === 'color') {
    const img = el('img', 'cv-mark');
    img.src = faviconUrl(t.url, 64);
    img.alt = ''; img.draggable = false;
    img.onerror = () => img.remove();
    box.append(img, el('span', 'cv-host', host));
  } else if (style === 'pattern') {
    box.append(patternSvg(host), el('span', 'cv-chip', host));
  } else if (style === 'mono') {
    box.append(el('span', 'cv-big', (t.title || host).charAt(0).toUpperCase()), el('span', 'cv-host', host));
  }
  return box;
}
