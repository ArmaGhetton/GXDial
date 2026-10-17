// Подменяет встроенную стартовую страницу Opera на страницу GX Dial — как можно быстрее
const DIAL_URL = chrome.runtime.getURL('newtab.html');
const recent = new Set();

// настройка «Заменять стартовую страницу» держится в памяти, чтобы не ждать хранилище на каждой вкладке
let enabled = true;
const ready = chrome.storage.local.get('settings').then(({ settings }) => {
  enabled = !settings || settings.replaceStart !== false;
});
chrome.storage.onChanged.addListener(ch => {
  if (ch.settings) enabled = !ch.settings.newValue || ch.settings.newValue.replaceStart !== false;
});

function isStartPage(url) {
  return !!url && /^(opera|chrome):\/\/(startpage|newtab)/i.test(url);
}

async function swap(tabId, url) {
  if (!isStartPage(url) || recent.has(tabId)) return;
  await ready;
  if (!enabled) return;
  recent.add(tabId);
  setTimeout(() => recent.delete(tabId), 1500);
  chrome.tabs.update(tabId, { url: DIAL_URL }).catch(() => {});
}

chrome.tabs.onCreated.addListener(tab => swap(tab.id, tab.pendingUrl || tab.url));
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url) swap(tabId, info.url);
  else if (info.status === 'loading') swap(tabId, tab.pendingUrl || tab.url);
});

// при запуске браузера (и при каждом пробуждении) подменяем уже открытые стартовые страницы
async function sweep() {
  const tabs = await chrome.tabs.query({});
  tabs.forEach(t => swap(t.id, t.pendingUrl || t.url));
}
chrome.runtime.onStartup.addListener(sweep);
chrome.runtime.onInstalled.addListener(sweep);
sweep();

// Opera усыпляет фоновую часть расширения после 30 секунд тишины —
// будим её раз в полминуты, чтобы новая вкладка подменялась без задержки
chrome.alarms.create('keepalive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => {});

// Клик по значку расширения открывает панель
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: DIAL_URL }));
