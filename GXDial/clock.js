// Часы, дата и погода над строкой поиска.
// Погода — из открытых сервисов без ключа: Open-Meteo, а если он недоступен — wttr.in или Met Norway. Город ищется через геокодер Open-Meteo.
const WX_API = 'https://api.open-meteo.com/v1/forecast';
const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';
const WX_TTL = 30 * 60 * 1000;
let wxData = null, wxLoading = false, clockLast = '';

// коды погоды WMO → вид значка и описание
function wxKind(code) {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 67) return code >= 56 && code <= 57 || code >= 66 ? 'sleet' : 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}
const WX_TEXT = {
  ru: { clear: 'Ясно', partly: 'Переменная облачность', cloudy: 'Пасмурно', fog: 'Туман', rain: 'Дождь', sleet: 'Ледяной дождь', snow: 'Снег', storm: 'Гроза' },
  en: { clear: 'Clear', partly: 'Partly cloudy', cloudy: 'Overcast', fog: 'Fog', rain: 'Rain', sleet: 'Freezing rain', snow: 'Snow', storm: 'Thunderstorm' }
};
function wxIcon(kind, day) {
  const sun = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  const moon = '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>';
  const cloud = '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 11 3.5 3.5 0 0 0 7 18z"/>';
  const small = '<path d="M8 2.5v1.2M3.4 4.4l.9.9M12.6 4.4l-.9.9M2 9h1.2" /><path d="M5.3 10.5a3 3 0 1 1 5.5-2.2"/>';
  const smallMoon = '<path d="M10.5 3.2A3.6 3.6 0 0 0 5 8.6a3.6 3.6 0 0 0 1.4.6"/>';
  const drops = '<path d="M8 20l-1 2M12 20l-1 2M16 20l-1 2"/>';
  const flakes = '<path d="M8 21h.01M12 22h.01M16 21h.01M10 19.5h.01M14 19.5h.01"/>';
  const bolt = '<path d="m13 15-2.5 4h3L11 23"/>';
  const lowCloud = '<path d="M7 16h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9 3.5 3.5 0 0 0 7 16z"/>';
  const fog = '<path d="M4 14h16M6 18h12M8 22h8"/><path d="M7 10a5 5 0 0 1 10 0"/>';
  const body = {
    clear: day ? sun : moon,
    partly: (day ? small : smallMoon) + '<path d="M9 19h8.5a3.5 3.5 0 0 0 .4-6.97A5 5 0 0 0 8.4 13 3 3 0 0 0 9 19z"/>',
    cloudy: cloud, fog, rain: lowCloud + drops, sleet: lowCloud + drops + flakes, snow: lowCloud + flakes, storm: lowCloud + bolt
  }[kind];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

// navigator.language в некоторых системах приходит с нестандартным хвостом (en-US@posix) — Intl такой тег не принимает
function sysLocale() {
  const l = navigator.language || '';
  try { Intl.getCanonicalLocales(l); return l; } catch { return 'en-US'; }
}
function locale() { const s = sysLocale(); return LANG === 'en' ? (s.startsWith('en') ? s : 'en-US') : 'ru-RU'; }
function fmtTemp(v) {
  const n = Math.round(S.units === 'f' ? v * 9 / 5 + 32 : v);
  return (n < 0 ? '−' + Math.abs(n) : String(n)) + '°';
}

// ---------- часы ----------
function tickClock() {
  const box = $('clock');
  if (!S.clock) return;
  const now = new Date();
  const parts = new Intl.DateTimeFormat(sysLocale() || 'ru-RU', { hour: 'numeric', minute: '2-digit', second: S.clockSec ? '2-digit' : undefined }).formatToParts(now);
  const key = parts.map(p => p.value).join('') + LANG;
  if (key === clockLast) return;
  clockLast = key;
  const hm = box.querySelector('.c-hm');
  hm.innerHTML = '';
  parts.forEach(p => {
    if (p.type === 'literal' && p.value.trim() === ':') hm.append(el('span', 'c-col', ':'));
    else if (p.type === 'dayPeriod') hm.append(el('span', 'c-ap', p.value));
    else if (p.type === 'second') hm.append(el('span', 'c-sec', p.value));
    else hm.append(document.createTextNode(p.value));
  });
  let date = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  date = date.charAt(0).toUpperCase() + date.slice(1);
  box.querySelector('.c-date').textContent = date;
}

// ---------- погода ----------
// текст последней ошибки погоды (видно при наведении на плашку)
let wxError = '';
function wxSearchHref(w) { return 'https://www.google.com/search?q=' + encodeURIComponent((LANG === 'en' ? 'weather ' : 'погода ') + w.name); }
// город ещё не выбран — вместо погоды приглашение: щелчок открывает настройки у поля города
function wxPrompt(a) {
  a.hidden = false; a.href = '#'; a.removeAttribute('title'); a.classList.remove('night');
  a.querySelector('.wx-ic').innerHTML = wxIcon('cloudy', 1);
  a.querySelector('.wx-t').textContent = '';
  a.querySelector('.wx-d').textContent = L('Выбрать город для погоды');
  a.querySelector('.wx-city').textContent = '';
  a.onclick = e => { e.preventDefault(); openPanel(); $('wxCity').focus(); };
}
// город выбран, но данных нет (нет сети или сервис не отвечает)
function wxFailed(a, w) {
  a.hidden = false; a.onclick = null; a.href = wxSearchHref(w); a.classList.remove('night');
  a.title = `${L('Погода недоступна')}: ${wxError}`;
  a.querySelector('.wx-ic').innerHTML = wxIcon('cloudy', 1);
  a.querySelector('.wx-t').textContent = '–';
  a.querySelector('.wx-d').textContent = L('Погода недоступна');
  a.querySelector('.wx-city').textContent = w.name;
}
function renderWeather() {
  const a = $('clock').querySelector('.c-wx');
  const w = S.weather;
  if (!w) return wxPrompt(a);
  if (!wxData || wxData.key !== wxKey()) {
    if (wxError) return wxFailed(a, w);   // сервис не ответил — покажем это, а не будем молчать
    a.hidden = true; return;              // ещё загружается
  }
  const c = wxData.current, k = wxKind(c.weather_code);
  a.hidden = false; a.onclick = null;
  a.href = 'https://www.google.com/search?q=' + encodeURIComponent((LANG === 'en' ? 'weather ' : 'погода ') + w.name);
  a.querySelector('.wx-ic').innerHTML = wxIcon(k, c.is_day);
  a.querySelector('.wx-t').textContent = fmtTemp(c.temperature_2m);
  a.querySelector('.wx-d').textContent = WX_TEXT[LANG][k];
  a.querySelector('.wx-city').textContent = w.name;
  const d = wxData.daily;
  a.title = `${w.name}${w.region ? ', ' + w.region : ''}\n${L('Ощущается как')} ${fmtTemp(c.apparent_temperature)} · ${L('Ветер')} ${Math.round(c.wind_speed_10m)} ${L('м/с')}` +
    (d ? `\n${L('Днём')} ${fmtTemp(d.temperature_2m_max[0])} · ${L('Ночью')} ${fmtTemp(d.temperature_2m_min[0])}` : '');
  a.classList.toggle('night', !c.is_day);
}
function wxKey() { return S.weather ? `${S.weather.lat.toFixed(3)},${S.weather.lon.toFixed(3)}` : ''; }
// открытые сервисы погоды по очереди: если один недоступен (блокировка, сбой), берём следующий
async function fetchWeatherAny(lat, lon) {
  const errs = [];
  for (const src of [weatherOpenMeteo, weatherWttr, weatherMet]) {
    try { return await src(lat, lon); }
    catch (e) { errs.push(String((e && e.message) || e)); }
  }
  throw new Error(errs.join('; '));
}
// 1) Open-Meteo: отдаёт данные сразу в нужном виде
async function weatherOpenMeteo(lat, lon) {
  const q = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto', forecast_days: 1, wind_speed_unit: 'ms',
    current: 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min'
  });
  const r = await fetch(`${WX_API}?${q}`);
  if (!r.ok) throw new Error('open-meteo ' + r.status);
  const j = await r.json();
  return { current: j.current, daily: j.daily };
}
// 2) wttr.in: без ключа; его коды погоды переводим в коды WMO, которые понимает wxKind()
async function weatherWttr(lat, lon) {
  const r = await fetch(`https://wttr.in/${lat.toFixed(4)},${lon.toFixed(4)}?format=j1`);
  if (!r.ok) throw new Error('wttr.in ' + r.status);
  const j = await r.json();
  const c = j.current_condition[0], d = j.weather[0], h = new Date().getHours();
  return {
    current: {
      temperature_2m: +c.temp_C, apparent_temperature: +c.FeelsLikeC,
      weather_code: wwoToWmo(+c.weatherCode), is_day: h >= 7 && h < 21 ? 1 : 0,
      wind_speed_10m: +c.windspeedKmph / 3.6
    },
    daily: { temperature_2m_max: [+d.maxtempC], temperature_2m_min: [+d.mintempC] }
  };
}
// 3) Met Norway: почасовой прогноз; максимум и минимум дня считаем по ближайшим 24 часам
async function weatherMet(lat, lon) {
  const r = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
  if (!r.ok) throw new Error('met.no ' + r.status);
  const ts = (await r.json()).properties.timeseries;
  const det = ts[0].data.instant.details;
  const next = ts[0].data.next_1_hours || ts[0].data.next_6_hours;
  const sym = next ? next.summary.symbol_code : 'cloudy';
  const temps = ts.slice(0, 24).map(t => t.data.instant.details.air_temperature);
  return {
    current: {
      temperature_2m: det.air_temperature, apparent_temperature: det.air_temperature,
      weather_code: metToWmo(sym), is_day: sym.endsWith('_night') ? 0 : 1, wind_speed_10m: det.wind_speed
    },
    daily: { temperature_2m_max: [Math.max(...temps)], temperature_2m_min: [Math.min(...temps)] }
  };
}
// wttr.in: коды WWO → коды WMO
function wwoToWmo(c) {
  if (c === 113) return 0;
  if (c === 116) return 2;
  if (c === 119 || c === 122) return 3;
  if (c === 143 || c === 248 || c === 260) return 45;
  if ([200, 386, 389, 392, 395].includes(c)) return 95;
  if ([179, 227, 230, 323, 326, 329, 332, 335, 338, 368, 371].includes(c)) return 73;
  if ([182, 185, 281, 284, 311, 314, 317, 320, 350, 362, 365, 374, 377].includes(c)) return 56;
  if ([176, 263, 266, 293, 296, 299, 302, 305, 308, 353, 356, 359].includes(c)) return 61;
  return 3;
}
// Met Norway: символы погоды → коды WMO
function metToWmo(sym) {
  const s = sym.replace(/_(day|night|polartwilight)$/, '');
  if (s.includes('thunder')) return 95;
  if (s.includes('sleet')) return 56;
  if (s.includes('snow')) return s.startsWith('heavy') ? 75 : 73;
  if (s.includes('rain')) return s.startsWith('heavy') ? 65 : 61;
  return { clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45 }[s] ?? 3;
}
async function loadWeather(force) {
  if (!S.weather || wxLoading) return renderWeather();
  if (!wxData) {
    const st = await chrome.storage.local.get(['wxCache']);
    wxData = st.wxCache || null;
  }
  const fresh = wxData && wxData.key === wxKey() && Date.now() - wxData.at < WX_TTL;
  renderWeather();
  if (fresh && !force) return;
  wxLoading = true; wxError = '';
  try {
    const data = await fetchWeatherAny(S.weather.lat, S.weather.lon);
    wxData = { key: wxKey(), at: Date.now(), current: data.current, daily: data.daily };
    chrome.storage.local.set({ wxCache: wxData });
  } catch (e) { wxError = String((e && e.message) || e); /* нет сети — оставляем последние данные */ }
  wxLoading = false;
  renderWeather();
}

// ---------- настройки ----------
function syncClock() {
  const box = $('clock');
  box.hidden = !S.clock && !S.weather;
  box.classList.toggle('no-time', !S.clock);
  clockLast = '';
  if (S.clock) tickClock();
  document.querySelectorAll('[data-seg="units"] button').forEach(b => b.classList.toggle('on', b.dataset.val === (S.units || 'c')));
  const now = $('wxNow');
  now.innerHTML = '';
  if (S.weather) {
    now.append(el('span', '', L('Сейчас') + ': '), el('b', '', S.weather.name + (S.weather.region ? ', ' + S.weather.region : '')));
    const x = el('button', 'btn ghost narrow', L('Убрать'));
    x.type = 'button';
    x.onclick = () => { S.weather = null; wxData = null; saveSettings(); syncClock(); };
    now.append(x);
  }
  now.hidden = !S.weather;
  loadWeather();
}
async function findCity() {
  const q = $('wxCity').value.trim();
  const list = $('wxResults');
  list.innerHTML = '';
  if (!q) return;
  list.append(el('div', 'wx-msg', L('Ищу…')));
  try {
    const r = await fetch(`${GEO_API}?${new URLSearchParams({ name: q, count: 6, language: LANG, format: 'json' })}`);
    const j = await r.json();
    list.innerHTML = '';
    if (!j.results || !j.results.length) { list.append(el('div', 'wx-msg', L('Город не найден'))); return; }
    j.results.forEach(c => {
      const b = el('button', 'wx-opt');
      b.type = 'button';
      const region = [c.admin1, c.country].filter(Boolean).join(', ');
      b.append(el('b', '', c.name), el('span', '', region));
      b.onclick = () => {
        S.weather = { name: c.name, region, lat: c.latitude, lon: c.longitude };
        wxData = null;
        list.innerHTML = '';
        $('wxCity').value = '';
        saveSettings(); syncClock(); loadWeather(true);
      };
      list.append(b);
    });
  } catch {
    list.innerHTML = '';
    list.append(el('div', 'wx-msg', L('Нет связи с сервисом погоды')));
  }
}
$('wxFind').onclick = findCity;
$('wxCity').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findCity(); } });
document.querySelectorAll('[data-seg="units"] button').forEach(b => {
  b.onclick = () => { S.units = b.dataset.val; saveSettings(); syncClock(); renderWeather(); };
});

setInterval(tickClock, 1000);
setInterval(() => loadWeather(), 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { clockLast = ''; tickClock(); loadWeather(); } });
syncClock();
