/* Реклама: баннеры лежат в базе (ads/<id>), добавляются из panel.html.
   Подключение: <script src="ads.js" data-mode="home|game"></script> (после profile.js).
   home — главная: после 3-й игры, только после первой сыгранной игры.
   game — игра: тонкий баннер сверху через 10 секунд + баннер в окне конца партии.
   Закрыли баннер: этот баннер не показывается 10 минут (если есть другие объявления) или 1 час (если других нет). */
(function () {
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const A = window.Ads = {};
  const mode = document.currentScript && document.currentScript.dataset.mode;
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const okUrl = u => /^https:\/\//i.test(u || '');
  const hiddenUntil = id => +LS.get('kh_adh_' + id) || 0;
  const isHidden = id => hiddenUntil(id) > Date.now();

  A.load = () => A._p || (A._p = (async () => {
    try {
      const uid = await Profile.init(); if (!uid) return [];
      const s = await firebase.database().ref('ads').once('value'), v = s.val() || {};
      return Object.keys(v).map(id => Object.assign({ id }, v[id]));
    } catch (e) { return []; }
  })());

  A.active = (list, slot) => { const t = today(); return list.filter(a => a && a.on === true && a.places && a.places[slot] && a.img && /^data:image\//.test(a.img) && okUrl(a.url) &&
    !(a.from && t < a.from) && !(a.to && t > a.to)); };
  A.pick = (list, slot) => { const c = A.active(list, slot).filter(a => !isHidden(a.id)); return c.length ? c[Math.floor(Math.random() * c.length)] : null; };

  function count(id, k) {
    Profile.init().then(uid => { if (uid) firebase.database().ref('stats/ads/' + id + '/' + k).set(firebase.database.ServerValue.increment(1)).catch(() => {}); }).catch(() => {});
  }

  function css() {
    if (document.getElementById('adx-css')) return;
    const s = document.createElement('style'); s.id = 'adx-css';
    s.textContent = `.adx{position:relative;border-radius:18px;overflow:hidden;box-shadow:0 6px 18px rgba(74,18,54,.16);background:#fff;font-family:Manrope,system-ui,sans-serif;text-align:left}
.adx a{display:flex;color:#4A1236;text-decoration:none}
.adx-image img{display:block;width:100%;aspect-ratio:3/1;object-fit:cover}
.adx-card a{align-items:center;gap:12px;padding:20px 40px 12px 14px;background:linear-gradient(120deg,#fff,#FFF1F6)}
.adx-th{flex:none;width:64px;height:64px;border-radius:14px;object-fit:cover}
.adx-tx{min-width:0}.adx-tx b{display:block;font-weight:800;font-size:16px;line-height:1.15}
.adx-tx span{display:block;margin-top:2px;font-size:13px;line-height:1.3;opacity:.8;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.adx-l{position:absolute;left:8px;top:6px;padding:1px 6px;border-radius:6px;background:rgba(255,255,255,.8);color:#6b4a5c;font:700 9px Manrope,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;pointer-events:none}
.adx-x{position:absolute;right:6px;top:6px;width:28px;height:28px;padding:0;border:0;border-radius:99px;background:rgba(255,255,255,.92);color:#4A1236;box-shadow:0 1px 4px rgba(0,0,0,.35);font:700 16px/28px Manrope,system-ui,sans-serif;text-align:center;cursor:pointer}
.adx-home{margin:0}
.adx-end{margin:14px 0 0}
.adx-game{flex:none;width:calc(100% - 24px);max-width:420px;margin:max(8px,calc(env(safe-area-inset-top) + 2px)) auto 0;border-radius:14px;box-shadow:0 4px 12px rgba(74,18,54,.14)}
.adx-game.adx-image{max-width:none}.adx-game.adx-image img{aspect-ratio:11/2}
.adx-game.adx-card a{gap:10px;padding:16px 38px 7px 10px}
.adx-game .adx-th{width:40px;height:40px;border-radius:10px}
.adx-game .adx-tx b{font-size:14px}
.adx-game .adx-tx span{font-size:12px;-webkit-line-clamp:1}
.adx-game + header,body:has(> .adx-game) header{padding-top:10px!important}`;
    document.head.appendChild(s);
  }

  /* opts: { list, preview, count } */
  A.render = function (ad, size, opts) {
    opts = opts || {}; css();
    const el = document.createElement('div'); el.className = 'adx adx-' + size + ' adx-' + (ad.type === 'card' ? 'card' : 'image'); el.dataset.adId = ad.id || '';
    const a = document.createElement('a'); a.href = okUrl(ad.url) ? ad.url : '#'; a.target = '_blank'; a.rel = 'noopener noreferrer sponsored';
    const img = document.createElement('img'); img.src = (size === 'game' && ad.type !== 'card' && /^data:image\//.test(ad.imgGame || '')) ? ad.imgGame : ad.img; img.alt = ad.title || 'Реклама'; img.className = ad.type === 'card' ? 'adx-th' : '';
    a.appendChild(img);
    if (ad.type === 'card') {
      const tx = document.createElement('div'); tx.className = 'adx-tx';
      const b = document.createElement('b'); b.textContent = ad.title || ''; tx.appendChild(b);
      if (ad.text) { const sp = document.createElement('span'); sp.textContent = ad.text; tx.appendChild(sp); }
      a.appendChild(tx);
    }
    const l = document.createElement('span'); l.className = 'adx-l'; l.textContent = 'Реклама';
    const x = document.createElement('button'); x.type = 'button'; x.className = 'adx-x'; x.textContent = '×'; x.setAttribute('aria-label', 'Закрыть рекламу');
    el.append(a, l, x);
    if (opts.preview) { a.onclick = e => e.preventDefault(); x.onclick = e => e.preventDefault(); return el; }
    a.addEventListener('click', () => count(ad.id, 'clk'));
    x.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      const others = A.active(opts.list || [], size === 'game' || size === 'end' ? size : 'home').filter(o => o.id !== ad.id && !isHidden(o.id));
      LS.set('kh_adh_' + ad.id, String(Date.now() + (others.length ? 10 : 60) * 60000));
      el.remove(); if (opts.onClose) opts.onClose();
    };
    if (opts.count) {
      let done = false;
      const fire = () => { if (!done) { done = true; count(ad.id, 'imp'); } };
      if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fire(); } }, { threshold: 0.5 }); io.observe(el); } else fire();
    }
    return el;
  };

  const played = () => LS.get('kh_played') === '1';
  const markPlayed = () => LS.set('kh_played', '1');

  function home(list) {
    if (!played()) return;
    const ad = A.pick(list, 'home'); if (!ad) return;
    const el = A.render(ad, 'home', { list, count: true });
    const games = document.querySelectorAll('.game');
    if (games.length >= 3) games[2].insertAdjacentElement('afterend', el); else (games[games.length - 1] || document.querySelector('main') || document.body).insertAdjacentElement('afterend', el);
  }

  function game(list) {
    setTimeout(() => {
      markPlayed();
      if (document.querySelector('.adx-game')) return;
      const ad = A.pick(list, 'game'); if (!ad) return;
      document.body.insertBefore(A.render(ad, 'game', { list, count: true }), document.body.firstChild);
    }, 10000);
    let endAd = null, counted = false, closed = false;
    const sync = () => {
      const card = document.querySelector('.over .card');
      if (!card) { endAd = null; counted = false; closed = false; return; }
      markPlayed();
      if (closed || card.querySelector('.adx')) return;
      if (!endAd) endAd = A.pick(list, 'end');
      if (!endAd) return;
      const el = A.render(endAd, 'end', { list, count: !counted, onClose: () => { closed = true; } });
      counted = true; card.appendChild(el);
    };
    new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
    sync();
  }

  if (mode) {
    const go = () => A.load().then(list => { if (!list.length) return; if (mode === 'home') home(list); else if (mode === 'game') game(list); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }
})();
