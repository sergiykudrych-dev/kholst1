/* Аналитика (Google Analytics 4) — только после согласия посетителя, без имён, почт и кодов комнат. */
(function () {
  'use strict';
  const ID = String((window.FIREBASE_CONFIG || {}).measurementId || '').trim();
  const K = 'kh_consent';
  const store = {
    get() { try { return localStorage.getItem(K); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(K, v); } catch (e) {} }
  };
  const GAMES = ['paint', 'word', 'number', 'egg', 'chips', 'tictactoe', 'memory', 'monster', 'questions'];
  const pageName = () => (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
  const cleanUrl = () => location.origin + location.pathname + location.search;   /* без #room=… */
  const optedOut = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  const status = () => (optedOut() ? 'denied' : store.get());   /* granted | denied | null */
  const queue = []; let loaded = false;

  /* Собственные обезличенные счётчики для панели владельца: только числа по дням, без имён и кодов комнат. */
  const OWN = {
    page_view: () => 'views',
    game_open: p => p.game && 'open_' + p.game,
    game_complete: p => p.host && p.game && ['game_complete', 'done_' + p.game],   /* считает только хозяин комнаты, чтобы не удваивать */
    room_created: () => 'room_created', partner_joined: () => 'partner_joined', invite_sent: () => 'invite_sent', lobby_invite: () => 'lobby_invite', open_created: () => 'open_created', open_joined: () => 'open_joined', code_shared: () => 'code_shared', report_sent: () => 'report_sent', friend_request: () => 'friend_request',
    friend_added: () => 'friend_added', profile_saved: p => ['profile_saved', p.method === 'telegram' ? 'saved_tg' : p.method === 'google' ? 'saved_google' : null].filter(Boolean), auth_pick: p => 'auth_pick_' + (p.method === 'telegram' ? 'tg' : 'google'), name_set: () => 'name_set',
    promo_view: () => 'promo_view', promo_click: p => ['promo_click', 'promo_click_' + (p.where === 'end' ? 'end' : 'home')]
  };
  async function own(name, params) {
    try {
      const f = OWN[name], keys = f && f(params || {}); if (!keys) return;
      if (/^promo_/.test(name)) { try { if (localStorage.getItem('kh_me') === '1' || localStorage.getItem('kh_owner') === '1') return; } catch (e) {} }   /* свои нажатия на рекламу не считаем */
      if (!(window.Profile && window.firebase && firebase.database && Profile.init)) return;
      const uid = await Profile.init(); if (!uid) return;
      const db = firebase.database(), inc = firebase.database.ServerValue.increment(1), day = new Date().toISOString().slice(0, 10);
      const add = k => db.ref('stats/daily/' + day + '/' + k).set(inc).catch(() => {});
      let last = null; try { last = localStorage.getItem('kh_seen_day'); } catch (e) {}
      if (last !== day) {
        try { localStorage.setItem('kh_seen_day', day); } catch (e) {}
        db.ref('stats/users/' + day + '/' + uid).set(1).then(() => add('users')).catch(() => {});
        db.ref('stats/seen/' + uid).set(1).then(() => { add('newusers'); db.ref('stats/total/users').set(inc).catch(() => {}); }).catch(() => {});
      }
      [].concat(keys).forEach(add);
    } catch (e) {}
  }

  /* Журнал действий для владельца: ник, время, что сделал. Ведётся для всех посетителей, включая Telegram (раскрыто в политике конфиденциальности); свои действия владельца не пишутся. */
  const ACT = new Set(['page_view', 'game_open', 'room_created', 'partner_joined', 'invite_sent', 'lobby_invite', 'open_created', 'open_joined', 'code_shared', 'report_sent', 'friend_request', 'friend_added', 'profile_saved', 'auth_pick', 'name_set', 'chat_sent', 'game_complete', 'promo_click']);
  let actN = 0, actLast = '', actAt = 0;
  async function act(name, params) {
    try {
      if (!ACT.has(name) || actN >= 150) return;
      try { if (localStorage.getItem('kh_me') === '1' || localStorage.getItem('kh_owner') === '1') return; } catch (e) {}   /* свои действия не пишем */
      const p = params || {}, g = String(p.game || p.method || (name === 'page_view' ? pageName() : '') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 20);
      const key = name + '|' + g, now = Date.now();
      if (key === actLast && now - actAt < 2000) return;   /* не дублируем одно и то же подряд */
      actLast = key; actAt = now;
      if (!(window.Profile && window.firebase && firebase.database && Profile.init)) return;
      const uid = await Profile.init(); if (!uid) return;
      let n = ''; try { n = String((Profile.name && Profile.name()) || ''); } catch (e) {}
      const rec = { u: uid, n: (n || 'без имени').slice(0, 40), a: name, t: firebase.database.ServerValue.TIMESTAMP };
      if (g) rec.g = g;
      try {   /* код друга и устройство: чтобы в журнале видеть код человека и когда он меняется */
        const c = String(localStorage.getItem('kh_fcode') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12); if (c) rec.c = c;
        let d = localStorage.getItem('kh_dev'); if (!d) { d = Math.random().toString(36).slice(2, 12); localStorage.setItem('kh_dev', d); } rec.d = d.replace(/[^a-z0-9]/g, '').slice(0, 12);
      } catch (e) {}
      actN++;
      firebase.database().ref('activity/' + new Date().toISOString().slice(0, 10)).push(rec).catch(() => {});
    } catch (e) {}
  }

  /* «Сейчас на сайте»: анонимная отметка присутствия (только случайный id и время), удаляется при выходе. Имена и действия сюда не пишутся. */
  let presOn = false;
  async function presence() {
    try {
      if (presOn) return; presOn = true;
      try { if (localStorage.getItem('kh_me') === '1' || localStorage.getItem('kh_owner') === '1') return; } catch (e) {}
      if (!(window.Profile && window.firebase && firebase.database && Profile.init)) return;
      const uid = await Profile.init(); if (!uid) return;
      const ref = firebase.database().ref('presence/' + uid), TS = firebase.database.ServerValue.TIMESTAMP;
      const beat = () => { if (document.visibilityState === 'hidden') return; ref.onDisconnect().remove().catch(() => {}); ref.set({ t: TS }).catch(() => {}); };
      beat(); setInterval(beat, 45000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') beat(); });
    } catch (e) {}
  }

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
    own('page_view');
    queue.splice(0).forEach(e => { gtag('event', e[0], e[1]); own(e[0], e[1]); });
  }

  const T = window.Track = {
    enabled: !!ID,
    status,
    event(name, params) {
      act(name, Object.assign({ screen: pageName() }, params || {}));   /* журнал владельца ведётся всегда, независимо от согласия на Google Analytics */
      if (!ID || status() === 'denied') return;
      const p = Object.assign({ screen: pageName() }, params || {});
      if (loaded) { gtag('event', name, p); own(name, p); } else if (queue.length < 50) queue.push([name, p]);
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
    d.innerHTML = `<div class="kc" role="dialog" aria-label="Согласие на статистику"><p>Мы считаем анонимную статистику посещений (Google Analytics), чтобы улучшать игры. Имена, почты и коды комнат в Google не передаются. Отдельно владелец сайта ведёт закрытый журнал действий (ник, время, что сделано) — он ведётся всегда, см. <a href="privacy.html">политику</a>.</p><div class="kb"><button type="button" data-v="denied">Отказаться</button><button type="button" class="y" data-v="granted">Принять</button></div></div>`;
    d.onclick = e => { const b = e.target.closest('button'); if (b) T.set(b.dataset.v); };
    document.body.appendChild(d);
  }

  const start = () => {
    setTimeout(() => { if (!GAMES.includes(pageName())) act('page_view'); }, 1500);   /* заход на страницу — в журнал владельца всегда (ник к этому моменту уже известен) */
    setTimeout(presence, 2500);
    if (!ID) return;
    if (status() === 'granted') load(); else if (status() === null && pageName() !== 'privacy') {
      const show = () => { if (document.querySelector('.pf-ov')) return setTimeout(show, 700); banner(); };   /* не поверх окна «Как вас зовут?» */
      setTimeout(show, 900);
    }
    if (GAMES.includes(pageName())) T.event('game_open', { game: pageName() });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* Обезличенный счётчик посещений и источников для панели владельца — работает без согласия:
   только числа по дням (сколько людей, откуда пришли), без имён, почт, кодов комнат и без передачи третьим лицам. */
(function () {
  'use strict';
  const MAP = [[/threads\./, 'th'], [/instagram\./, 'ig'], [/tiktok\./, 'tt'], [/google\.|googlequicksearch/, 'google'], [/facebook\.|fb\./, 'fb'], [/t\.me|telegram/, 'tg'], [/vk\.com/, 'vk'], [/bing\.|yandex\.|duckduckgo/, 'search']];
  function src() {
    try {
      const f = new URLSearchParams(location.search).get('from');
      if (/^(ig|th|tt|tg)$/.test(f || '')) return f;
      if (/^[a-z0-9][a-z0-9_-]{1,23}$/.test(f || '')) return 'c_' + f;   /* рекламная ссылка из панели: ?from=название */
    } catch (e) {}
    let r = ''; try { r = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
    if (!r || r === location.hostname) return 'direct';
    for (const [re, k] of MAP) if (re.test(r)) return k;
    return 'other';
  }
  async function count() {
    if (/panel\.html$/.test(location.pathname)) return;
    /* свои заходы не считаем: ?me=1 включает исключение на этом устройстве, ?me=0 выключает; где открывалась панель — тоже не считаем */
    try {
      const m = new URLSearchParams(location.search).get('me');
      if (m === '1') localStorage.setItem('kh_me', '1'); else if (m === '0') localStorage.removeItem('kh_me');
      if (localStorage.getItem('kh_me') === '1' || localStorage.getItem('kh_owner') === '1') return;
    } catch (e) {}
    let ss = null; try { ss = sessionStorage.getItem('kh_vis'); } catch (e) {}
    if (ss) return;                                   /* одно посещение на сессию, не каждая страница */
    try { sessionStorage.setItem('kh_vis', '1'); } catch (e) {}
    if (!(window.Profile && Profile.init && window.firebase)) return;
    const uid = await Profile.init(); if (!uid) return;
    const db = firebase.database(), inc = firebase.database.ServerValue.increment(1), day = new Date().toISOString().slice(0, 10);
    const add = k => db.ref('stats/daily/' + day + '/' + k).set(inc).catch(() => {});
    add('v_all'); add('v_' + src());
    let d = null; try { d = localStorage.getItem('kh_vday'); } catch (e) {}
    if (d !== day) { try { localStorage.setItem('kh_vday', day); } catch (e) {} add('p_all'); }
  }
  const go = () => setTimeout(() => { count().catch(() => {}); }, 1200);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
