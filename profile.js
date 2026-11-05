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
    if (P.notify) P.notify();
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
      try { P.uid = (await firebase.auth().signInAnonymously()).user.uid; } catch (e) {}
      return P.uid;
    })();
    return P._init;
  };

  /* Игра вызывает Profile.start(room, me, перерисовать) сразу после firebase.initializeApp. */
  P.start = function (room, me, onChange) {
    P.room = room; P.me = me;
    const db = firebase.database(), TS = firebase.database.ServerValue.TIMESTAMP;
    const chip = document.getElementById('me');
    P.notify = () => {
      if (chip) chip.textContent = 'Вы — ' + window.pnRaw(me);
      if (onChange && P.gotData) { try { onChange(); } catch (e) {} }
    };
    P.publish = () => {
      const rec = { t: TS }; if (P.uid) rec.uid = P.uid;
      if (P.name()) rec.name = P.name(); if (P.avatar()) rec.avatar = P.avatar();
      const jobs = [db.ref('rooms/' + room + '/players/p' + me).update(rec).catch(P.denied)];
      if (P.uid && P.name()) jobs.push(db.ref('users/' + P.uid).update({ name: P.name(), avatar: P.avatar() || null, updated: TS }).catch(() => {}));
      return Promise.all(jobs);
    };
    const auth = P.init().then(() => {});
    P.ready = auth.then(() => {
      db.ref('rooms/' + room + '/players').on('value', s => {
        const v = s.val() || {}; P.names = { 1: v.p1 || null, 2: v.p2 || null }; P.notify();
      }, P.denied);
      return P.publish();
    });
    P.ready.then(() => { if (!P.has() && !P.skipped()) P.ask().then(ok => ok && P.publish()); });
    if (chip) { chip.style.cursor = 'pointer'; chip.onclick = () => P.ask().then(ok => ok && P.publish()); }
    P.notify();
    return P.ready;
  };

  /* Подписка на состояние игры — только после входа и записи имени в комнату. */
  P.on = (ref, cb) => P.ready.then(() => ref.on('value', s => { P.gotData = true; cb(s); }, P.denied));
})();
