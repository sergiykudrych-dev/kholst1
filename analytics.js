/* Аналитика (Google Analytics 4) — только после согласия посетителя, без имён, почт и кодов комнат. */
(function () {
  'use strict';
  const ID = String((window.FIREBASE_CONFIG || {}).measurementId || '').trim();
  const K = 'kh_consent';
  const store = {
    get() { try { return localStorage.getItem(K); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(K, v); } catch (e) {} }
  };
  const GAMES = ['paint', 'word', 'number', 'egg', 'chips', 'tictactoe', 'memory', 'monster'];
  const pageName = () => (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
  const cleanUrl = () => location.origin + location.pathname + location.search;   /* без #room=… */
  const optedOut = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  const status = () => (optedOut() ? 'denied' : store.get());   /* granted | denied | null */
  const queue = []; let loaded = false;

  function load() {
    if (loaded || !ID || status() !== 'granted') return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', ID, { send_page_view: false, anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
    const s = document.createElement('script'); s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
    document.head.appendChild(s);
    gtag('event', 'page_view', { page_title: document.title, page_location: cleanUrl(), page_path: location.pathname });
    queue.splice(0).forEach(e => gtag('event', e[0], e[1]));
  }

  const T = window.Track = {
    enabled: !!ID,
    status,
    event(name, params) {
      if (!ID || status() === 'denied') return;
      const p = Object.assign({ screen: pageName() }, params || {});
      if (loaded) gtag('event', name, p); else if (queue.length < 50) queue.push([name, p]);
    },
    set(v) {
      store.set(v);
      if (v === 'granted') load();
      else { queue.length = 0; if (loaded) { window['ga-disable-' + ID] = true; } }
      const b = document.getElementById('kh-consent'); if (b) b.remove();
      document.dispatchEvent(new Event('kh-consent'));
    }
  };

  function banner() {
    const css = document.createElement('style');
    css.textContent = `#kh-consent{position:fixed;left:0;right:0;bottom:0;z-index:80;padding:10px 10px max(10px,env(safe-area-inset-bottom));pointer-events:none}
#kh-consent .kc{pointer-events:auto;max-width:480px;margin:0 auto;padding:14px 16px;border-radius:20px;background:#fff;color:#4A1236;box-shadow:0 14px 40px -10px rgba(74,18,54,.6);font:500 13px/1.4 Manrope,system-ui,sans-serif}
#kh-consent p{margin:0 0 10px}#kh-consent a{color:#C2185B}
#kh-consent .kb{display:flex;gap:8px}
#kh-consent button{flex:1;padding:11px;border-radius:12px;border:1.5px solid #C2185B;background:#fff;color:#C2185B;font:700 14px Manrope,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
#kh-consent button.y{background:#C2185B;color:#fff}`;
    document.head.appendChild(css);
    const d = document.createElement('div'); d.id = 'kh-consent';
    d.innerHTML = `<div class="kc" role="dialog" aria-label="Согласие на статистику"><p>Мы считаем анонимную статистику посещений (Google Analytics), чтобы улучшать игры. Имена, почты и коды комнат не передаются. <a href="privacy.html">Подробнее</a></p><div class="kb"><button type="button" data-v="denied">Отказаться</button><button type="button" class="y" data-v="granted">Принять</button></div></div>`;
    d.onclick = e => { const b = e.target.closest('button'); if (b) T.set(b.dataset.v); };
    document.body.appendChild(d);
  }

  const start = () => {
    if (!ID) return;
    if (status() === 'granted') load(); else if (status() === null && pageName() !== 'privacy') {
      const show = () => { if (document.querySelector('.pf-ov')) return setTimeout(show, 700); banner(); };   /* не поверх окна «Как вас зовут?» */
      setTimeout(show, 900);
    }
    if (GAMES.includes(pageName())) T.event('game_open', { game: pageName() });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
