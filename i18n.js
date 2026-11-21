/* Языки сайта: ru (исходный), uk, en.
   Выбор: ?lang=… → сохранённый выбор → язык Telegram → язык телефона/браузера.
   Подключается первым скриптом в <head>: сразу грузит словарь и переводит страницу по мере её появления. */
(function () {
  'use strict';
  const LANGS = ['ru', 'uk', 'en'];
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const norm = c => {
    c = String(c || '').toLowerCase().slice(0, 2);
    if (c === 'ua') c = 'uk';
    if (c === 'be' || c === 'kk') c = 'ru';
    return LANGS.includes(c) ? c : '';
  };
  function tgLang() {
    try {
      let d = new URLSearchParams(location.hash.slice(1)).get('tgWebAppData') || sessionStorage.getItem('kh_tg') || '';
      const u = JSON.parse(new URLSearchParams(d).get('user') || 'null');
      return u && norm(u.language_code);
    } catch (e) { return ''; }
  }
  function detect() {
    const q = norm(new URLSearchParams(location.search).get('lang'));
    if (q) { ls.set('kh_lang', q); return q; }
    const s = norm(ls.get('kh_lang')); if (s) return s;
    const t = tgLang(); if (t) return t;
    const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']).map(norm);
    return list.find(Boolean) || 'en';
  }
  const L = detect();
  window.LANG = L;
  document.documentElement.lang = L;
  window.setLang = l => { l = norm(l) || 'ru'; ls.set('kh_lang', l); const u = new URL(location.href); u.searchParams.delete('lang'); location.replace(u.toString()); };
  window.T = s => s;
  if (L === 'ru') return;

  /* словарь грузим синхронно, пока страница ещё разбирается */
  document.write('<script src="i18n-' + L + '.js?v=1"><\/script>');

  const CYR = /[А-Яа-яЁё]/;
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  let D = null, RX = null;
  const done = new WeakMap();   /* узел → текст, который мы туда записали (чтобы не переводить повторно) */

  function dict() {
    if (D) return D;
    D = window.I18N_D || null; if (!D) return null;
    /* для фраз, собранных из кусочков (имя + текст, число + слово): ищем известные куски целыми словами */
    const keys = Object.keys(D).filter(k => k.length > 1 && !/^[А-Яа-яЁё]$/.test(k)).sort((a, b) => b.length - a.length);
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const L0 = /^[А-Яа-яЁёA-Za-z]/, L1 = /[А-Яа-яЁёA-Za-z]$/;   /* границы слова — только там, где кусок начинается/кончается буквой */
    RX = new RegExp(keys.map(k => (L0.test(k) ? '(?<![А-Яа-яЁёA-Za-z])' : '') + esc(k) + (L1.test(k) ? '(?![А-Яа-яЁё])' : '')).join('|'), 'g');
    return D;
  }
  function tr(s) {
    if (!s || !CYR.test(s) || !dict()) return s;
    const t = s.replace(/\s+/g, ' ').trim();
    if (D[t] !== undefined) { const a = s.match(/^\s*/)[0], b = s.match(/\s*$/)[0]; return a + D[t] + b; }
    const cell = t.match(/^([А-ЯЁ])(\d{1,2})$/);   /* клетки морского боя: Б4 → B4 */
    if (cell && D[cell[1]]) return s.replace(t, D[cell[1]] + cell[2]);
    return s.replace(RX, m => D[m] !== undefined ? D[m] : m);
  }
  window.T = s => tr(String(s));

  function noTr(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (SKIP[e.tagName] || e.hasAttribute('data-noi18n') || (e.classList && (e.classList.contains('ch-m') || e.classList.contains('ch-bub')))) return true;
    }
    return false;
  }
  function textNode(n) {
    if (done.get(n) === n.data || !CYR.test(n.data) || noTr(n.parentNode)) return;
    const v = tr(n.data); done.set(n, v); if (v !== n.data) n.data = v;
  }
  function attrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && CYR.test(v)) { const t = tr(v); if (t !== v) el.setAttribute(a, t); }
    }
    if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && CYR.test(el.value)) el.value = tr(el.value);
  }
  function walk(root) {
    if (!dict()) return;
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.nodeType !== 1 || root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
    attrs(root);
    if (SKIP[root.tagName]) return;   /* в data-noi18n текст не трогаем (это проверяет textNode), а подписи кнопок переводим */
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) textNode(n);
      else if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') continue;
      else attrs(n);
    }
  }
  const mo = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') textNode(m.target);
      else if (m.type === 'attributes') attrs(m.target);
      else m.addedNodes.forEach(walk);
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.addEventListener('DOMContentLoaded', () => { walk(document.documentElement); if (CYR.test(document.title)) document.title = tr(document.title); });

  /* стандартные окна браузера тоже переводим */
  const _alert = window.alert, _confirm = window.confirm, _prompt = window.prompt;
  window.alert = m => _alert.call(window, tr(String(m)));
  window.confirm = m => _confirm.call(window, tr(String(m)));
  window.prompt = (m, d) => _prompt.call(window, tr(String(m)), d);
})();
