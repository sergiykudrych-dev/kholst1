/* Установка как приложение + уведомления о приглашениях (этап 1).
   Ключ для уведомлений: window.PUSH_VAPID_KEY в firebase-config.js
   (Firebase → Настройки проекта → Cloud Messaging → Web Push certificates). */
(function () {
  'use strict';
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js';
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const inApp = /Instagram|FBAN|FBAV|Telegram|TikTok|musical_ly|BytedanceWebview|Line\//i.test(ua);
  const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
  const canPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
  const ev = (n, p) => { try { window.Track && Track.event(n, p); } catch (e) {} };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const key = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = (h * 33 ^ t.charCodeAt(i)) >>> 0; return 'k' + h.toString(36) + t.length.toString(36); };
  const dev = () => isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';
  let deferred = null, boxEl = null, instEl = null, dlg = null;
  const Push = window.Push = {};

  const css = document.createElement('style');
  css.textContent = `.instbtn{display:block;width:100%;margin:14px 0 0;padding:13px;border:1.5px solid rgba(255,255,255,.7);border-radius:16px;background:rgba(255,255,255,.14);color:#fff;font:700 15px Manrope,sans-serif;cursor:pointer;touch-action:manipulation}
.instbtn[hidden]{display:none}
.instbtn:not([hidden]) + .sharesite{margin-top:0}
#pdlg{max-width:420px;padding:22px 18px 18px}
#pdlg h2{font-size:30px;margin:0 0 6px}
#pdlg .x{top:12px;right:12px;width:36px;height:36px;border-radius:50%;background:#F7E1EA;font-size:15px;line-height:36px;padding:0;color:#8E0F45}
#pdlg .pl{margin:0 0 14px;color:#8A5570;font-size:14px}
#pdlg ol{list-style:none;padding:0;margin:0;display:grid;gap:10px}
#pdlg li{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:#fff;font:600 15px/1.3 Manrope,system-ui,sans-serif;color:#4A1236;text-align:left}
#pdlg li b{font-weight:800}
#pdlg li .n{flex:none;width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#E8548C,#C2185B);color:#fff;display:grid;place-items:center;font:800 14px Manrope,sans-serif}
#pdlg li svg{flex:none;vertical-align:-5px;margin:0 2px}
#pdlg .pnote{margin:14px 0 0;padding:12px 14px;border-radius:16px;background:#FFF1F6;border:1.5px dashed #E7B1C6;color:#4A1236;font-size:13px;text-align:left}
#pdlg .go{display:block;width:100%;margin-top:14px;padding:14px;border:0;border-radius:99px;background:linear-gradient(90deg,#E8548C,#C2185B);color:#fff;font:800 16px Manrope,sans-serif;cursor:pointer}
.notibtn{position:absolute;top:max(14px,env(safe-area-inset-top));left:14px;display:flex;align-items:center;gap:5px;height:38px;padding:0 13px 0 10px;font-size:13px!important;border:0;border-radius:99px;background:#fff;color:#8E0F45;font:800 14px Manrope,system-ui,sans-serif;box-shadow:0 10px 20px -10px rgba(20,0,30,.7);cursor:pointer;touch-action:manipulation}
.notibtn[hidden]{display:none}
body.hasbell main{padding-top:max(76px,calc(env(safe-area-inset-top) + 60px))}.notibtn:active{transform:scale(.95)}
.notibtn .bell{font-size:18px;line-height:1}
.notibtn.ask::after{content:"";position:absolute;top:5px;left:25px;width:9px;height:9px;border-radius:50%;background:#FF3D8B;box-shadow:0 0 0 2px #fff}
.notibtn.on .st{color:#1F6B3A}
#pdlg .fpush{margin:0;background:none;padding:4px 0 0}
#pdlg .fpush .fb.ok{display:block;width:100%;margin-top:14px;padding:14px;border:0;border-radius:99px;background:linear-gradient(90deg,#E8548C,#C2185B);color:#fff;font:800 16px Manrope,sans-serif}
.fpush{margin:0 0 14px;padding:14px;border-radius:20px;background:#fff;text-align:center;font-size:14px;color:#4A1236}
.fpush b{display:block;font-size:15px;margin-bottom:2px}
.fpush small{display:block;color:#8A5570;font-size:13px}
.fpush .fb{margin-top:10px}
.fpush .on{color:#1F6B3A}
.fpush .lnk{display:inline-block;margin:8px 8px 0;background:none;border:0;padding:0;color:#8A5570;text-decoration:underline;font:600 13px Manrope,system-ui,sans-serif;cursor:pointer}`;
  document.head.appendChild(css);

  const ICON_SHARE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M8 7l4-4 4 4M6 11H5v10h14V11h-1"/></svg>';
  const ICON_PLUS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A1236" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; paintInst(); });
  window.addEventListener('appinstalled', () => { deferred = null; ev('app_installed'); paintInst(); if (dlg && dlg.open) dlg.close(); });

  // ---------- установка ----------
  function steps() {
    const li = (i, h) => `<li><span class="n">${i}</span><span>${h}</span></li>`;
    if (inApp) return `<p class="pl">Сейчас сайт открыт внутри другого приложения. Установить отсюда нельзя.</p><ol>${li(1, 'Нажмите <b>⋯</b> или <b>⋮</b> в углу')}${li(2, isIOS ? 'Выберите <b>«Открыть в Safari»</b>' : 'Выберите <b>«Открыть в браузере»</b>')}${li(3, 'И нажмите здесь «Установить» ещё раз')}</ol>`;
    if (isIOS) return `<p class="pl">Иконка появится на экране телефона, игры откроются на весь экран, и можно будет включить уведомления.</p><ol>
${li(1, `Нажмите ${ICON_SHARE}<b>«Поделиться»</b> внизу экрана<br><small style="color:#8A5570">в новом Safari: сначала <b>⋯</b></small>`)}
${li(2, `Пролистайте и выберите ${ICON_PLUS}<b>«На экран „Домой“»</b>`)}
${li(3, 'Нажмите <b>«Добавить»</b>')}</ol>
<p class="pnote">💡 В приложении у iPhone отдельная память. Чтобы друзья и статистика перенеслись, сначала сохраните профиль: <b>Друзья → Сохранить через Google</b>, а в приложении войдите тем же аккаунтом.</p>`;
    if (deferred) return `<p class="pl">Иконка появится на экране телефона, игры откроются на весь экран.</p><button class="go" type="button" data-a="install">Установить</button>`;
    if (isAndroid) return `<p class="pl">Иконка появится на экране телефона, игры откроются на весь экран.</p><ol>${li(1, 'Нажмите <b>⋮</b> в правом верхнем углу браузера')}${li(2, 'Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>')}${li(3, 'Подтвердите')}</ol>`;
    return `<p class="pl">Сайт откроется отдельным окном, как программа.</p><ol>${li(1, 'В адресной строке нажмите значок <b>установки</b> (монитор со стрелкой)')}${li(2, 'Или меню браузера → <b>«Установить…»</b>')}</ol>`;
  }
  Push.openInstall = function (forPush, notify) {
    if (!notify) ev('install_open', { dev: dev(), push: !!forPush });
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'pdlg'; document.body.appendChild(dlg);
      dlg.onclick = async e => {
        if (e.target === dlg) { const r = dlg.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close(); return; }
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.a === 'close') dlg.close();
        if (b.dataset.a === 'install' && deferred) { const d = deferred; deferred = null; d.prompt(); try { const r = await d.userChoice; ev('install_choice', { r: r && r.outcome }); } catch (e) {} dlg.close(); paintInst(); }
      };
    }
    const x = '<button class="x" type="button" data-a="close" aria-label="Закрыть">✕</button>';
    if (notify) { dlg.innerHTML = x + '<h2>Уведомления</h2><div id="pdbox"></div>'; Push.mount(dlg.querySelector('#pdbox')); }
    else dlg.innerHTML = x + (forPush ? '<h2>Уведомления</h2><p class="pl">🔔 На iPhone уведомления приходят, когда сайт установлен как приложение. Это займёт 10 секунд:</p>' + steps().replace(/^<p class="pl">.*?<\/p>/, '') + '<p class="pl" style="margin-top:12px">Потом откройте игру с иконки и нажмите 🔔 вверху.</p>' : '<h2>Как приложение</h2>' + steps());
    dlg.showModal(); try { document.activeElement.blur(); } catch (e) {}
  };
  function paintInst() { if (instEl) instEl.hidden = standalone(); }
  Push.installButton = function (el) {
    instEl = el; if (!el) return;
    el.onclick = () => Push.openInstall(); paintInst();
  };

  // ---------- уведомления ----------
  const VAPID = () => window.PUSH_VAPID_KEY || '';
  let sdkP = null;
  const loadSdk = () => sdkP || (sdkP = new Promise((res, rej) => {
    if (window.firebase && firebase.messaging) return res();
    const s = document.createElement('script'); s.src = SDK; s.onload = () => res(); s.onerror = () => { sdkP = null; rej(new Error('sdk')); }; document.head.appendChild(s);
  }));
  const uid = () => new Promise(res => {
    const a = firebase.auth(); if (a.currentUser) return res(a.currentUser.uid);
    const off = a.onAuthStateChanged(u => { if (u) { off(); res(u.uid); } });
  });
  async function token() {
    await loadSdk();
    const reg = await navigator.serviceWorker.register('firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;
    const t = await firebase.messaging().getToken({ vapidKey: VAPID(), serviceWorkerRegistration: reg });
    if (!t) throw new Error('token');
    return { t, reg };
  }
  async function saveToken(t) {
    const u = await uid(), k = key(t), old = ls.get('push_key');
    const up = {}; up['push/' + u + '/' + k] = { t, d: dev(), at: firebase.database.ServerValue.TIMESTAMP };
    if (old && old !== k) up['push/' + u + '/' + old] = null;
    await firebase.database().ref().update(up);
    ls.set('push_key', k); ls.set('push_on', '1');
  }
  Push.state = function () {
    if (!VAPID()) return 'off';
    if (isIOS && !standalone()) return 'install';
    if (!canPush()) return 'nosupport';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'granted' && ls.get('push_on') === '1') return 'on';
    return 'ask';
  };
  Push.enable = async function () {
    // Разрешение спрашиваем первым делом — iPhone требует, чтобы это было сразу после нажатия
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { ev('push_denied'); return false; }
    const { t, reg } = await token();
    await saveToken(t);
    ev('push_on', { dev: dev() });
    try { await reg.showNotification('Уведомления включены ✓', { body: 'Теперь вы узнаете, когда вас зовут играть 💗', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'test' }); } catch (e) {}
    return true;
  };
  Push.test = async function () {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.showNotification('Проверка 🔔', { body: 'Так будут выглядеть приглашения', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'test' });
  };
  Push.disable = async function () {
    try {
      const u = await uid(), k = ls.get('push_key');
      if (k) await firebase.database().ref('push/' + u + '/' + k).remove();
      await loadSdk(); const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await firebase.messaging().deleteToken().catch(() => {});
    } catch (e) {}
    ls.set('push_on', null); ls.set('push_key', null); ev('push_off');
  };
  // Тихо обновляем токен при заходе (он иногда меняется)
  Push.refresh = async function () {
    if (Push.state() !== 'on') return;
    try { const { t } = await token(); if (key(t) !== ls.get('push_key')) await saveToken(t); } catch (e) {}
  };

  // Блок в окне «Друзья»
  Push.mount = function (el) {
    boxEl = el; paintBell(); if (!el) return;
    const st = Push.state();
    el.hidden = st === 'off';
    let h = '';
    if (st === 'install') h = '<b>🔔 Уведомления о приглашениях</b><small>На iPhone они работают, когда сайт установлен как приложение</small><button class="fb ok" type="button" data-p="inst">Как установить</button>';
    else if (st === 'nosupport') h = '<b>🔔 Уведомления</b><small>Этот браузер не умеет присылать уведомления</small>';
    else if (st === 'denied') h = '<b>🔕 Уведомления запрещены</b><small>Разрешите их в настройках ' + (isIOS ? 'iPhone → Уведомления → Во что сыграем?' : 'браузера для этого сайта') + '</small>';
    else if (st === 'on') h = '<b class="on">🔔 Уведомления включены</b><small>Вы узнаете, когда друг зовёт играть</small><button class="lnk" type="button" data-p="test">Проверить</button><button class="lnk" type="button" data-p="off">Выключить</button>';
    else h = '<b>🔔 Узнавайте, когда вас зовут играть</b><small>Пришлём уведомление, когда друг пригласит вас в игру или в друзья — даже если сайт закрыт</small><button class="fb ok" type="button" data-p="on">Включить уведомления</button>';
    el.className = 'fpush'; el.innerHTML = h;
    el.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return; const a = b.dataset.p;
      if (a === 'inst') return Push.openInstall();
      if (a === 'test') return Push.test();
      if (a === 'off') { b.disabled = true; await Push.disable(); return Push.mount(el); }
      if (a === 'on') {
        b.disabled = true; b.textContent = 'Включаем…';
        try { await Push.enable(); } catch (err) { console.warn(err); el.innerHTML = '<b>Не получилось 😕</b><small>Проверьте интернет и попробуйте ещё раз</small><button class="fb" type="button" data-p="again">Ещё раз</button>'; ev('push_error', { m: String(err && err.message || err).slice(0, 60) }); return; }
        Push.mount(el);
      }
      if (a === 'again') Push.mount(el);
    };
  };
  let bellEl = null;
  function paintBell() {
    if (!bellEl) return; const st = Push.state();
    bellEl.hidden = st === 'off'; document.body.classList.toggle('hasbell', st !== 'off');
    bellEl.className = 'notibtn' + (st === 'on' ? ' on' : st === 'ask' || st === 'install' ? ' ask' : '');
    bellEl.innerHTML = st === 'on' ? '<span class="bell">🔔</span><span class="st">Вкл</span>' : st === 'denied' ? '<span class="bell">🔕</span>Выкл' : '<span class="bell">🔔</span>Уведомления';
  }
  Push.openNotify = function () {
    ev('push_open', { st: Push.state() });
    if (Push.state() === 'install') { Push.openInstall(true); return; }
    Push.openInstall(false, true);
  };
  Push.bellButton = function (el) { bellEl = el; if (!el) return; el.onclick = () => Push.openNotify(); paintBell(); };
  Push.isStandalone = standalone;
})();
