/* Чат в играх: кнопка 💬 в шапке, шторка с перепиской, всплывающее новое сообщение.
   Один чат на комнату (rooms/<room>/chat), общий для всех игр по этой ссылке. Подключается после fx.js. */
(function () {
  'use strict';
  const MAX = 200, KEEP = 50;
  const QUICK = ['Твой ход 😏', 'Удачи! 🍀', 'Ну ты даёшь 😂', 'Ещё партию?', '💗', '😘'];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const onlyEmoji = s => /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,8}$/u.test(s) && !/[\w\dа-яё]/i.test(s);
  let ref = null, me = 0, msgs = [], unread = 0, open = false, last = 0, btn, sheet, list, inp, bubbleT, seenKey;
  /* дружба с партнёром: '' — нет, 'out' — я поделился кодом, 'in' — партнёр поделился, 'ok' — друзья */
  let fst = '', puid = '', fref = null, myCode = '';
  const URL_RE = /(https?:\/\/|www\.)\S+|\b[\w-]+\.(com|ru|ua|net|org|me|io|app|link|xyz|site|online|shop|info|top|cc|gg|tk)\b\S*|t\.me\/\S+|@[A-Za-z0-9_]{4,}/gi;
  const isPub = () => !!(window.Profile && Profile.pub);
  const mask = t => isPub() ? t.replace(URL_RE, '🔗×') : t;

  const css = document.createElement('style');
  css.textContent = `.ch-b{position:relative;flex:none;width:44px!important;height:44px;padding:0!important;display:grid;place-items:center;font-size:20px;line-height:1;margin-left:auto}
header .ch-b + #fx-btn,header .ch-b + .fx-b{margin-left:0}
.ch-b u{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#E8548C;color:#fff;font:800 11px/20px Manrope,system-ui,sans-serif;text-decoration:none;text-align:center;box-shadow:0 0 0 2px #fff}
.ch-b u:empty{display:none}
.ch-bub{position:fixed;z-index:65;left:50%;bottom:max(18px,calc(env(safe-area-inset-bottom) + 10px));transform:translate(-50%,10px);opacity:0;width:max-content;max-width:min(90vw,420px);padding:10px 16px;border-radius:20px;background:#fff;color:#4A1236;font:700 15px/1.3 Manrope,system-ui,sans-serif;box-shadow:0 14px 30px -12px rgba(74,18,54,.6);transition:opacity .25s,transform .25s;cursor:pointer;pointer-events:none}
.ch-bub.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}
.ch-bub small{display:block;font-size:11px;color:#8A5570;margin-bottom:2px}
.ch-dim{position:fixed;inset:0;z-index:66;background:none;pointer-events:none}
.ch-dim.on{pointer-events:auto}
body.ch-open #view,body.ch-open .adx-game{opacity:.35;filter:saturate(.7);transition:opacity .2s}
.ch-sh{position:fixed;left:16px;right:16px;top:50%;z-index:67;height:min(70dvh,560px);max-width:520px;margin:0 auto;display:flex;flex-direction:column;background:#fff;border-radius:28px;box-shadow:0 30px 70px -18px rgba(74,18,54,.55),0 0 0 1px rgba(194,24,91,.08);transform:translateY(-50%) scale(.96);opacity:0;visibility:hidden;transition:opacity .2s,transform .2s,visibility 0s .2s;font-family:Manrope,system-ui,sans-serif}
.ch-sh.on{transform:translateY(-50%);opacity:1;visibility:visible;transition:opacity .2s,transform .2s}
.ch-sh.kb{top:var(--kt);height:var(--kh);transform:none}
.ch-gr{display:none}
.ch-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 6px 18px;font-weight:800;font-size:17px;color:#8E0F45;flex:none}
.ch-hd button{width:36px;height:36px;border:0;border-radius:50%;background:#F7E1EA;color:#8E0F45;font-size:15px;cursor:pointer}
.ch-ls{flex:1;min-height:0;overflow-y:auto;padding:6px 14px;display:flex;flex-direction:column;gap:8px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.ch-m{max-width:78%;padding:9px 13px;border-radius:18px;font-weight:600;font-size:15px;line-height:1.3;word-wrap:break-word;overflow-wrap:anywhere;-webkit-user-select:text;user-select:text}
.ch-m.l{align-self:flex-start;background:#FFF0F5;color:#4A1236;border-bottom-left-radius:6px}
.ch-m.r{align-self:flex-end;background:linear-gradient(135deg,#E8548C,#C2185B);color:#fff;border-bottom-right-radius:6px}
.ch-m.big{font-size:36px;line-height:1.1;background:none!important;box-shadow:none;padding:0 2px}
.ch-none{margin:auto;text-align:center;color:#8A5570;font-weight:700;font-size:14px;padding:20px}
.ch-q{display:flex;gap:8px;padding:6px 14px;overflow-x:auto;flex:none;scrollbar-width:none}
.ch-q::-webkit-scrollbar{display:none}
.ch-q button{flex:none;padding:8px 12px;border:0;border-radius:99px;background:#FFE3EE;color:#C2185B;font:800 13px Manrope,system-ui,sans-serif;cursor:pointer}
.ch-in{display:flex;gap:8px;padding:8px 14px 16px;flex:none}
.ch-in input{flex:1;min-width:0;height:46px;border-radius:99px;background:#fff;border:2px solid #F3B6CC;padding:0 16px;font:600 16px Manrope,system-ui,sans-serif;color:#4A1236;outline:none;-webkit-user-select:text;user-select:text}
.ch-in input:focus{border-color:#E8548C}
.ch-in button{flex:none;width:46px;height:46px;border:0;border-radius:50%;background:linear-gradient(135deg,#E8548C,#C2185B);color:#fff;font-size:20px;cursor:pointer}
.ch-in button:disabled{opacity:.45}
.ch-sys{align-self:center;text-align:center;max-width:92%;padding:10px 14px;border-radius:16px;background:#FFF6D6;color:#6B4E00;font:700 13px/1.35 Manrope,system-ui,sans-serif}
.ch-sys.fr{background:#E6F6EE;color:#1E6B45}
.ch-cd{width:82%;padding:12px 14px;border-radius:18px;background:#FFF0F5;color:#4A1236;font-family:Manrope,system-ui,sans-serif}
.ch-cd.l{align-self:flex-start;border-bottom-left-radius:6px}.ch-cd.r{align-self:flex-end;border-bottom-right-radius:6px;background:#FCE4EE}
.ch-cd small{display:block;font:700 12px Manrope,system-ui,sans-serif;color:#8A5570}
.ch-cd b{display:block;font:800 24px/1.2 Manrope,system-ui,sans-serif;letter-spacing:4px;color:#8E0F45;margin:4px 0 8px;-webkit-user-select:all;user-select:all}
.ch-cd button{width:100%;padding:10px;border:0;border-radius:12px;background:#C2185B;color:#fff;font:800 14px Manrope,system-ui,sans-serif;cursor:pointer}
.ch-cd button:disabled{opacity:.6}
.ch-cd .ok{display:block;text-align:center;font:700 13px Manrope,system-ui,sans-serif;color:#1E6B45;background:#E6F6EE;border-radius:12px;padding:9px}
.ch-q button.cd{background:#4A1236;color:#fff}
.ch-hd .ch-rep{width:auto;padding:0 12px;border-radius:99px;font:800 12px Manrope,system-ui,sans-serif;margin-left:auto;margin-right:8px}`;
  document.head.appendChild(css);

  const other = () => 3 - me;
  const nm = p => (window.Kit ? Kit.nm(p) : 'Партнёр');
  const av = p => (window.Kit ? Kit.av(p) : '');
  const play = () => { try { window.Fx && Fx.play('react'); } catch (e) {} };
  const setBadge = () => { if (btn) btn.querySelector('u').textContent = unread ? (unread > 9 ? '9+' : unread) : ''; };

  function draw() {
    if (!list) return;
    const pn = esc((av(other()) + ' ' + nm(other())).trim());
    const note = isPub() && fst !== 'ok' ? `<div class="ch-sys">🌍 <span data-noi18n>${pn}</span> <span>из открытой комнаты.</span><br><span>Вы пока не друзья — поделитесь кодом, если захотите играть снова.</span></div>` : '';
    if (!msgs.length) { list.innerHTML = note + `<div class="ch-none">Напишите что-нибудь партнёру 💬<br><small>Чат общий для всех игр в этой комнате</small></div>`; syncQuick(); return; }
    list.innerHTML = note + msgs.map(m => {
      const mine = m.f === me;
      if (m.sys === 'fr') return `<div class="ch-sys fr">💗 <span>Теперь вы друзья!</span></div>`;
      if (m.code) {
        const st = mine ? (fst === 'ok' ? `<span class="ok">✓ Вы друзья</span>` : `<span class="ok"><span data-noi18n>${pn}</span> <span>может добавить вас в друзья</span></span>`)
          : (fst === 'ok' ? `<span class="ok">✓ Вы друзья</span>` : `<button type="button" data-add="${esc(m.code)}">👥 Добавить в друзья</button>`);
        return `<div class="ch-cd ${mine ? 'r' : 'l'}"><small>${mine ? 'Вы поделились кодом игрока' : `<span data-noi18n>${esc(av(m.f) + ' ' + nm(m.f))}</span> <span>поделился(ась) кодом игрока</span>`}</small><b data-noi18n>${esc(m.code)}</b>${st}</div>`;
      }
      return `<div class="ch-m ${mine ? 'r' : 'l'} ${onlyEmoji(m.t) ? 'big' : ''}">${esc(mask(m.t))}</div>`;
    }).join('');
    list.scrollTop = list.scrollHeight; syncQuick();
  }
  function bubble(m) {
    let b = document.querySelector('.ch-bub');
    if (!b) { b = document.createElement('div'); b.className = 'ch-bub'; b.onclick = () => toggle(true); document.body.appendChild(b); }
    const T = window.T || (x => x);
    /* код игрока и «теперь друзья» показываем словами, а не кодом */
    const tx = m.code ? '👥 ' + T('хочет добавить вас в друзья') + ' — ' + T('откройте чат') : m.sys === 'fr' ? '💗 ' + T('Теперь вы друзья!') : mask(m.t);
    b.innerHTML = `<small>${esc(av(m.f))} ${esc(nm(m.f))}</small>${esc(tx.length > 90 ? tx.slice(0, 90) + '…' : tx)}`;
    b.classList.add('on'); clearTimeout(bubbleT); bubbleT = setTimeout(() => b.classList.remove('on'), 3500);
  }
  function fitKeyboard() {
    if (!sheet || !window.visualViewport) return;
    const vv = visualViewport, kb = innerHeight - vv.height > 120;
    sheet.classList.toggle('kb', kb && open);
    if (kb) { sheet.style.setProperty('--kt', (vv.offsetTop + 10) + 'px'); sheet.style.setProperty('--kh', Math.min(560, vv.height - 20) + 'px'); }
  }
  function toggle(v) {
    open = v; mount();
    sheet.classList.toggle('on', v); document.querySelector('.ch-dim').classList.toggle('on', v); document.body.classList.toggle('ch-open', v); fitKeyboard();
    if (v) { unread = 0; setBadge(); try { sessionStorage.setItem(seenKey, String(msgs.length ? msgs[msgs.length - 1].k : '')); } catch (e) {} draw(); const b = document.querySelector('.ch-bub'); if (b) b.classList.remove('on'); }
    else { try { inp.blur(); } catch (e) {} sheet.classList.remove('kb'); }
  }
  function send(t) {
    t = mask(String(t || '').replace(/\s+/g, ' ').trim()).slice(0, MAX);
    if (!t || !ref || Date.now() - last < 900) return;
    last = Date.now();
    ref.push({ f: me, t, ts: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
    try { window.Track && Track.event('chat_sent'); } catch (e) {}
    if (msgs.length > KEEP + 10) { const old = msgs.slice(0, msgs.length - KEEP); old.forEach(m => ref.child(m.k).remove().catch(() => {})); }
  }
  function mount() {
    if (sheet) return;
    const dim = document.createElement('div'); dim.className = 'ch-dim'; dim.onclick = () => toggle(false); document.body.appendChild(dim);
    sheet = document.createElement('div'); sheet.className = 'ch-sh';
    sheet.innerHTML = `<div class="ch-gr"></div><div class="ch-hd"><span>💬 ${esc(av(other()))} ${esc(nm(other()))}</span><button type="button" class="ch-rep" hidden>⚑ Пожаловаться</button><button type="button" class="ch-x" aria-label="Закрыть">✕</button></div><div class="ch-ls"></div>
<div class="ch-q"><button type="button" class="cd" hidden>🪪 Мой код</button>${QUICK.map(q => `<button type="button">${esc(q)}</button>`).join('')}</div>
<form class="ch-in"><input maxlength="${MAX}" placeholder="Сообщение…" autocomplete="off" enterkeyhint="send" aria-label="Сообщение"><button type="submit" aria-label="Отправить">↑</button></form>`;
    document.body.appendChild(sheet);
    list = sheet.querySelector('.ch-ls'); inp = sheet.querySelector('input');
    sheet.querySelector('.ch-x').onclick = () => toggle(false);
    sheet.querySelector('.ch-rep').onclick = report;
    sheet.querySelector('.ch-q').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.classList.contains('cd')) shareCode(b); else send(b.textContent); };
    list.onclick = e => { const b = e.target.closest('button[data-add]'); if (b) addFriend(b); };
    sheet.querySelector('form').onsubmit = e => { e.preventDefault(); send(inp.value); inp.value = ''; };
    // смахнуть шторку вниз
    if (window.visualViewport) { visualViewport.addEventListener('resize', fitKeyboard); visualViewport.addEventListener('scroll', fitKeyboard); }
    draw();
  }
  /* —— дружба через чат: «Мой код» и «Добавить в друзья» —— */
  const db = () => firebase.database();
  const myUid = () => window.Profile && Profile.uid;
  function watchFriend() {
    const n = window.Profile && Profile.names && Profile.names[other()], u = n && n.uid;
    if (!u || !myUid() || u === puid) return;
    puid = u; if (fref) fref.off();
    fref = db().ref('friends/' + myUid() + '/' + u + '/status');
    fref.on('value', s => { fst = s.val() || ''; syncQuick(); if (open) draw(); }, () => {});
  }
  function syncQuick() {
    if (!sheet) return;
    const c = sheet.querySelector('.ch-q .cd'); if (c) c.hidden = !(puid && myUid() && fst !== 'ok' && fst !== 'out' && !msgs.some(m => m.code && m.f === me));
    const r = sheet.querySelector('.ch-rep'); if (r) r.hidden = !isPub();
  }
  async function ensureCode() {
    if (myCode) return myCode;
    const u = (await db().ref('users/' + myUid()).once('value')).val() || {};
    if (u.code) return (myCode = u.code);
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 8; i++) {
      const c = Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join('');
      const r = await db().ref('codes/' + c).transaction(x => x === null ? myUid() : undefined);
      if (r.committed) { await db().ref('users/' + myUid()).update({ code: c, name: Profile.name() || null, avatar: Profile.avatar() || null }); return (myCode = c); }
    }
    throw new Error('code');
  }
  const meRec = () => ({ name: Profile.name() || null, avatar: Profile.avatar() || null, t: Date.now() });
  const pRec = () => { const n = Profile.names[other()] || {}; return { name: n.name || null, avatar: n.avatar || null, t: Date.now() }; };
  async function shareCode(b) {
    if (!puid || !ref) return; b.disabled = true;
    try {
      const code = await ensureCode(), up = {};
      const was = fst;
      if (was === 'in') {   /* партнёр уже поделился своим кодом — просто становимся друзьями */
        up['friends/' + myUid() + '/' + puid + '/status'] = 'ok'; up['friends/' + puid + '/' + myUid() + '/status'] = 'ok';
        await db().ref().update(up); notify('accepted'); ref.push({ f: me, t: '💗', sys: 'fr', ts: firebase.database.ServerValue.TIMESTAMP }); return;
      }
      /* делимся кодом = предлагаем дружбу: партнёру остаётся нажать «Добавить» */
      up['friends/' + myUid() + '/' + puid] = Object.assign({ status: 'out' }, pRec());
      up['friends/' + puid + '/' + myUid()] = Object.assign({ status: 'in' }, meRec());
      await db().ref().update(up);
      await ref.push({ f: me, t: '🪪 ' + code, code, ts: firebase.database.ServerValue.TIMESTAMP });
      try { window.Track && Track.event('code_shared'); } catch (e) {}
    } catch (e) { toast('Не получилось, попробуйте ещё раз'); }
    finally { b.disabled = false; syncQuick(); }
  }
  async function addFriend(b) {
    if (!puid) return; b.disabled = true; b.textContent = '…';
    try {
      const was = fst;
      if (was !== 'ok') {
        const up = {};
        if (was === 'in') { up['friends/' + myUid() + '/' + puid + '/status'] = 'ok'; up['friends/' + puid + '/' + myUid() + '/status'] = 'ok'; }
        else { up['friends/' + myUid() + '/' + puid] = Object.assign({ status: 'out' }, pRec()); up['friends/' + puid + '/' + myUid()] = Object.assign({ status: 'in' }, meRec()); }
        await db().ref().update(up);
        if (was === 'in') { notify('accepted'); ref.push({ f: me, t: '💗', sys: 'fr', ts: firebase.database.ServerValue.TIMESTAMP }); try { window.Track && Track.event('friend_added'); } catch (e) {} }
        else toast('Запрос отправлен');
      }
    } catch (e) { b.disabled = false; b.textContent = '👥 Добавить в друзья'; toast('Не получилось, попробуйте ещё раз'); }
  }
  async function notify(type) {
    const to = puid; if (!to) return;
    try {
      const u = firebase.auth().currentUser; if (!u) return; const tok = await u.getIdToken();
      if (window.PUSH_URL) fetch(window.PUSH_URL, { method: 'POST', keepalive: true, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ type, to }) }).catch(() => {});
      if (window.TG_AUTH_URL && /^tg_\d+$/.test(to)) fetch(window.TG_AUTH_URL.replace(/\/auth$/, '/notify'), { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: tok, type, to }) }).catch(() => {});
    } catch (e) {}
  }
  function toast(t) {
    let e = document.querySelector('.ch-bub'); if (!e) { e = document.createElement('div'); e.className = 'ch-bub'; document.body.appendChild(e); }
    e.textContent = t; e.classList.add('on'); clearTimeout(bubbleT); bubbleT = setTimeout(() => e.classList.remove('on'), 2500);
  }
  function report() {
    if (!confirm('Пожаловаться на игрока и выйти из комнаты?')) return;
    const n = Profile.names[other()] || {};
    const job = db().ref('rooms/_reports').push({ room: Profile.room, by: myUid() || null, who: n.uid || null, name: n.name || null, t: Date.now(), chat: msgs.slice(-20).map(m => (m.f === me ? '> ' : '< ') + m.t) }).catch(() => {});
    try { window.Track && Track.event('report_sent'); } catch (e) {}
    const go = () => { location.href = 'index.html'; };
    Promise.race([job, new Promise(r => setTimeout(r, 1500))]).then(() => db().ref('rooms/' + Profile.room + '/players/p' + me).update({ left: firebase.database.ServerValue.TIMESTAMP }).then(go, go));
  }
  function mountBtn() {
    const hd = document.querySelector('header'); if (!hd || document.getElementById('ch-btn')) return;
    btn = document.createElement('button'); btn.type = 'button'; btn.id = 'ch-btn'; btn.className = 'chip ch-b'; btn.setAttribute('aria-label', 'Чат');
    btn.innerHTML = '💬<u></u>';
    const fxb = document.getElementById('fx-btn');
    if (fxb) hd.insertBefore(btn, fxb); else hd.appendChild(btn);
    btn.onclick = () => toggle(!open);
  }
  function listen() {
    if (!window.Profile || !Profile.ready || !window.firebase) return;
    Profile.ready.then(() => {
      if (!Profile.room) return;
      me = Profile.me; seenKey = 'ch_seen_' + Profile.room;
      ref = firebase.database().ref('rooms/' + Profile.room + '/chat');
      let seen = ''; try { seen = sessionStorage.getItem(seenKey) || ''; } catch (e) {}
      const q = ref.limitToLast ? ref.limitToLast(KEEP) : ref;
      let initial = true; setTimeout(() => { initial = false; }, 1500);
      watchFriend(); setInterval(watchFriend, 3000);
      if (Profile.pubReady) Profile.pubReady.then(() => { if (open) draw(); syncQuick(); });
      q.on('child_added', s => {
        const v = s.val() || {}; if (typeof v.t !== 'string') return;
        const m = { k: s.key, f: v.f, t: v.t.slice(0, MAX), code: /^[A-Z0-9]{4,10}$/.test(v.code || '') ? v.code : '', sys: v.sys === 'fr' ? 'fr' : '' };
        msgs.push(m); if (msgs.length > KEEP) msgs.shift();
        if (open) { draw(); if (m.f !== me && !initial) play(); return; }
        if (m.f !== me && (!initial || (seen && m.k > seen))) { unread++; setBadge(); if (!initial) { bubble(m); play(); } }
      });
      q.on('child_removed', s => { msgs = msgs.filter(m => m.k !== s.key); if (open) draw(); });
    }).catch(() => {});
  }
  const go = () => { setTimeout(() => { mountBtn(); listen(); }, 0); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
