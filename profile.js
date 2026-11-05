/* Профиль игрока: имя и аватарка хранятся в телефоне, а в комнате и в базе — для второго игрока. */
(function () {
  'use strict';
  const AV = ['🐰', '🦊', '🐻', '🐼', '🐱', '🐶', '🦄', '🐸', '🐧', '🦁', '🐯', '🐨'];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clean = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  const ev = (n, p) => { try { window.Track && Track.event(n, p); } catch (e) {} };
  const P = window.Profile = { AV, uid: null, me: 0, names: { 1: null, 2: null }, gotData: false, ready: Promise.resolve() };

  P.name = () => clean(store.get('kh_name'));
  P.avatar = () => { const a = store.get('kh_avatar'); return AV.includes(a) ? a : ''; };
  P.has = () => !!P.name();
  P.skipped = () => store.get('kh_skip') === '1';

  const label = p => {
    let n = P.names[p];
    if (p === P.me && P.has()) n = { name: P.name(), avatar: P.avatar() };
    return n && n.name ? ((n.avatar || '') + ' ' + clean(n.name)).trim() : null;
  };
  window.pnRaw = p => label(p) || 'Игрок ' + p;
  window.pn = p => esc(window.pnRaw(p));

  let cssDone = false;
  function css() {
    if (cssDone) return; cssDone = true;
    const s = document.createElement('style');
    s.textContent = `.pf-ov{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:20px;background:rgba(74,18,54,.5);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);font-family:Manrope,system-ui,sans-serif}
.pf-card{width:100%;max-width:380px;padding:26px 20px 18px;border-radius:28px;background:#FFF8FA;color:#4A1236;text-align:center;box-shadow:0 30px 70px -20px rgba(74,18,54,.6)}
.pf-card h2{font:400 38px/1.1 'Marck Script',cursive;color:#8E0F45;margin:0}
.pf-card p{margin:6px 0 14px;color:#8A5570;font-size:14px}
.pf-in{width:100%;padding:13px 14px;border:1.5px solid #F3B6CC;border-radius:14px;background:#fff;font:600 16px Manrope,system-ui,sans-serif;color:#4A1236;-webkit-user-select:text;user-select:text;text-align:center}
.pf-av{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:14px 0}
.pf-av button{aspect-ratio:1;border:2px solid transparent;border-radius:14px;background:#fff;font-size:24px;line-height:1;cursor:pointer;touch-action:manipulation}
.pf-av button.on{border-color:#C2185B;background:#FFE3EC}
.pf-ok{width:100%;padding:14px;border:0;border-radius:16px;background:#C2185B;color:#fff;font:700 17px Manrope,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
.pf-ok:disabled{opacity:.4;cursor:default}
.pf-skip{margin-top:8px;padding:8px;border:0;background:none;color:#8A5570;font:500 14px Manrope,system-ui,sans-serif;cursor:pointer}
.pf-big{font-size:46px;margin-bottom:6px}.pf-card a{display:block;margin-top:14px;padding:14px;border-radius:16px;background:#C2185B;color:#fff;font-weight:700;text-decoration:none}`;
    document.head.appendChild(s);
  }

  P.save = function (name, avatar) {
    store.set('kh_name', clean(name)); store.set('kh_avatar', avatar || ''); store.set('kh_skip', '');
    ev('name_set'); if (P.notify) P.notify();
  };

  /* Окно «Как вас зовут?». Возвращает Promise<boolean>: true — имя сохранено. */
  P.ask = function () {
    css();
    return new Promise(res => {
      let av = P.avatar() || AV[Math.floor(Math.random() * AV.length)];
      const ov = document.createElement('div'); ov.className = 'pf-ov';
      ov.innerHTML = `<div class="pf-card" role="dialog" aria-modal="true"><h2>Как вас зовут?</h2><p>Так вас увидит второй игрок</p>
<input class="pf-in" maxlength="20" placeholder="Ваше имя" autocomplete="off" value="${esc(P.name())}" aria-label="Ваше имя">
<div class="pf-av">${AV.map(a => `<button type="button" data-a="${a}" class="${a === av ? 'on' : ''}" aria-label="${a}">${a}</button>`).join('')}</div>
<button class="pf-ok" type="button">Готово</button><button class="pf-skip" type="button">Пропустить</button></div>`;
      document.body.appendChild(ov);
      const inp = ov.querySelector('.pf-in'), ok = ov.querySelector('.pf-ok');
      const sync = () => { ok.disabled = !clean(inp.value); };
      inp.oninput = sync; sync();
      ov.querySelector('.pf-av').onclick = e => {
        const b = e.target.closest('button'); if (!b) return; av = b.dataset.a;
        ov.querySelectorAll('.pf-av button').forEach(x => x.classList.toggle('on', x === b));
      };
      const close = v => { ov.remove(); res(v); };
      ok.onclick = () => { if (!clean(inp.value)) return; P.save(inp.value, av); close(true); };
      inp.onkeydown = e => { if (e.key === 'Enter') ok.click(); };
      ov.querySelector('.pf-skip').onclick = () => { store.set('kh_skip', '1'); close(false); };
    });
  };

  function blocked(text) {
    if (document.querySelector('.pf-ov.pf-block')) return;
    css(); const ov = document.createElement('div'); ov.className = 'pf-ov pf-block';
    ov.innerHTML = `<div class="pf-card"><div class="pf-big">🔒</div><h2>Нет доступа</h2><p>${text}</p><a href="index.html">На главную</a></div>`;
    document.body.appendChild(ov);
  }
  P.denied = function (err) {
    if (!err || err.code !== 'PERMISSION_DENIED') return;
    blocked(P.uid ? 'Эта комната занята другим устройством. Создайте новую комнату на главной.' : 'База данных не пускает без входа. Проверьте, что в Firebase включён анонимный вход.');
  };

  /* Подключение к Firebase и анонимный вход (один раз). Возвращает Promise<uid|null>. */
  P.init = function () {
    if (P._init) return P._init;
    P._init = (async () => {
      const cfg = window.FIREBASE_CONFIG || {};
      if (!window.firebase || !/^https:\/\//.test(cfg.databaseURL || '')) return null;
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      if (!firebase.auth) return null;
      const auth = firebase.auth();
      /* Сначала ждём сохранённого входа: иначе анонимный вход подменил бы аккаунт Google. */
      let u = await new Promise(res => { const off = auth.onAuthStateChanged(x => { off(); res(x); }); });
      if (!u) { try { u = (await auth.signInAnonymously()).user; } catch (e) {} }
      P.uid = u ? u.uid : null;
      return P.uid;
    })();
    return P._init;
  };

  /* Сохранение профиля через Google: анонимный аккаунт превращается в постоянный (uid тот же). */
  const cu = () => (window.firebase && firebase.auth && firebase.apps.length) ? firebase.auth().currentUser : null;
  P.isLinked = () => { const u = cu(); return !!(u && !u.isAnonymous); };
  P.email = () => { const u = cu(); return (u && u.email) || ''; };
  P.linkGoogle = async function () {
    const auth = firebase.auth(), u = auth.currentUser, prov = new firebase.auth.GoogleAuthProvider();
    try {
      if (u && u.isAnonymous) await u.linkWithPopup(prov); else await auth.signInWithPopup(prov);
      return 'linked';
    } catch (e) {
      if (e && e.code === 'auth/credential-already-in-use' && e.credential) { await auth.signInWithCredential(e.credential); return 'switched'; }
      throw e;
    }
  };
  P.signOut = async function () { await firebase.auth().signOut(); };
  P.authError = function (e) {
    const c = (e && e.code) || '';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
    if (c === 'auth/popup-blocked') return 'Браузер заблокировал окно входа. Разрешите всплывающие окна для сайта.';
    if (c === 'auth/unauthorized-domain') return 'Домен сайта не добавлен в Firebase (Authentication → Settings → Authorized domains).';
    if (c === 'auth/operation-not-allowed') return 'Вход через Google не включён в Firebase.';
    if (c === 'auth/network-request-failed') return 'Нет связи. Проверьте интернет.';
    return 'Не получилось войти' + (c ? ' (' + c.replace('auth/', '') + ')' : '') + '.';
  };

  /* Игра вызывает Profile.start(room, me, перерисовать) сразу после firebase.initializeApp. */
  P.start = function (room, me, onChange) {
    P.room = room; P.me = me;
    if (me === 2) ev('room_joined');
    const db = firebase.database(), TS = firebase.database.ServerValue.TIMESTAMP;
    const chip = document.getElementById('me');
    P.notify = () => {
      if (chip) chip.textContent = 'Вы — ' + window.pnRaw(me);
      if (onChange && P.gotData) { try { onChange(); } catch (e) {} }
    };
    P.publish = () => {
      const rec = { t: TS, left: null }; if (P.uid) rec.uid = P.uid;
      if (P.name()) rec.name = P.name(); if (P.avatar()) rec.avatar = P.avatar();
      const jobs = [db.ref('rooms/' + room + '/players/p' + me).update(rec).catch(P.denied)];
      if (P.uid && P.name()) jobs.push(db.ref('users/' + P.uid).update({ name: P.name(), avatar: P.avatar() || null, updated: TS }).catch(() => {}));
      return Promise.all(jobs);
    };
    const auth = P.init().then(() => {});
    P.ready = auth.then(() => {
      db.ref('rooms/' + room + '/players').on('value', s => {
        const v = s.val() || {}; P.names = { 1: v.p1 || null, 2: v.p2 || null }; P.notify(); flush();
        leftNote(v['p' + (3 - me)]);
        if (me === 1 && v.p1 && v.p2 && !P._pj) { P._pj = 1; ev('partner_joined'); }
      }, P.denied);
      return P.publish();
    });
    P.ready.then(() => { if (!P.has() && !P.skipped()) P.ask().then(ok => ok && P.publish()); });
    if (chip) { chip.style.cursor = 'pointer'; chip.onclick = () => P.ask().then(ok => ok && P.publish()); }
    P.notify();
    return P.ready;
  };

  /* Партнёр вышел из игры: при нажатии «← Игры» ставим метку left, второму показываем плашку сверху. */
  function leftNote(o) {
    let el = document.querySelector('.pf-left');
    if (!o || !o.left) { if (el) el.remove(); P._ln = 0; return; }
    if (P._ln) return; P._ln = 1;
    if (!document.getElementById('pf-left-css')) { const st = document.createElement('style'); st.id = 'pf-left-css';
      st.textContent = '.pf-left{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:10px;max-width:92vw;padding:11px 14px;border-radius:16px;background:#4A1236;color:#fff;font:700 15px Manrope,system-ui,sans-serif;box-shadow:0 8px 24px rgba(74,18,54,.35);animation:pfl .3s ease}.pf-left button{border:0;background:rgba(255,255,255,.2);color:#fff;border-radius:99px;width:26px;height:26px;font-size:15px;cursor:pointer}@keyframes pfl{from{opacity:0;transform:translate(-50%,-14px)}}';
      document.head.appendChild(st); }
    el = document.createElement('div'); el.className = 'pf-left'; el.setAttribute('role', 'status');
    const t = document.createElement('span'); t.textContent = ((o.avatar ? o.avatar + ' ' : '') + (o.name || 'Партнёр')) + ' вышел(а) из игры';
    const b = document.createElement('button'); b.textContent = '×'; b.setAttribute('aria-label', 'Закрыть'); b.onclick = () => el.remove();
    el.append(t, b); document.body.appendChild(el);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href="index.html"]');
    if (!a || !P.room || !P.me || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); let go = false; const nav = () => { if (!go) { go = true; location.href = a.href; } };
    setTimeout(nav, 700);
    try { firebase.database().ref('rooms/' + P.room + '/players/p' + P.me).update({ left: firebase.database.ServerValue.TIMESTAMP }).then(nav, nav); } catch (x) { nav(); }
  }, true);

  /* История партий: каждый пишет результат только в свою ветку history/<uid>. */
  const hash = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  let pending = []; const seen = new Set();
  function flush() {
    if (!P.uid || !pending.length) return;
    const opp = P.names[3 - P.me]; if (!opp || !opp.uid) return;
    const db = firebase.database(), list = pending; pending = [];
    list.forEach(r => db.ref('history/' + P.uid + '/' + r.key).transaction(x => x === null
      ? { game: r.game, res: r.res, opp: opp.uid, oppName: opp.name || null, oppAvatar: opp.avatar || null, t: Date.now() } : undefined).catch(() => {}));
  }
  P.flush = flush;
  P.track = (game, calc) => { P.tracker = { game, calc }; };
  P.record = function (game, state, res) {
    const key = game + '_' + P.room + '_' + hash(JSON.stringify(state));
    if (seen.has(key)) return; seen.add(key); pending.push({ key, game, res }); flush();
  };

  /* Подписка на состояние игры — только после входа и записи имени в комнату. */
  P.on = (ref, cb) => P.ready.then(() => ref.on('value', s => {
    P.gotData = true; cb(s);
    const v = s.val();
    if (v && P.tracker) { let r = null; try { r = P.tracker.calc(v); } catch (e) {} if (r) { ev('game_complete', { game: P.tracker.game, result: r, host: P.me === 1 }); P.record(P.tracker.game, v, r); } }
  }, P.denied));
})();
