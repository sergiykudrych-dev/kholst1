/* Друзья: код друга, запросы, приглашения в игру. Работает на главной странице. */
(function () {
  'use strict';
  const P = window.Profile; if (!P) return;
  const PAGES = { paint: 'Холст', word: 'Угадай слово', number: 'Угадай число', egg: 'Не урони яйцо', chips: 'Чипсы-сюрприз', tictactoe: 'Крестики-нолики', memory: 'Найди пару', questions: 'Вопросы друг другу', monster: 'Создай монстра' };
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = s => document.querySelector(s);
  const F = window.Friends = { off: false };
  const ev = (n, p) => { try { window.Track && Track.event(n, p); } catch (e) {} };
  let db, me = null, myCode = '', list = {}, U = {}, target = null, dlg = null, ready = null, bar = null, tt;

  const css = document.createElement('style');
  css.textContent = `#fdlg{max-height:88dvh;overflow:auto;padding:22px 18px 18px}
#fdlg h2{font-size:34px;margin:0 0 12px}
#fdlg .x{top:12px;right:12px;width:36px;height:36px;border-radius:50%;background:#F7E1EA;font-size:15px;line-height:36px;padding:0;color:#8E0F45}
#fdlg button:focus{outline:none}#fdlg button:focus-visible{outline:2px solid #C2185B;outline-offset:2px}
#fdlg .sec{display:grid;gap:10px;margin:0 0 14px}
.fcard{padding:14px;border-radius:20px;background:#fff;text-align:center}
.flab{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8A5570}
.fcode{margin:4px 0 10px;font:800 32px/1.1 Manrope,system-ui,sans-serif;letter-spacing:5px;color:#8E0F45;-webkit-user-select:all;user-select:all}
.fcard.sec{gap:4px}.fcard .two{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0}
.fadd{display:grid;grid-template-columns:1fr auto;gap:8px;margin:0}
.fadd .link{margin:0;text-transform:uppercase;letter-spacing:2px;text-align:center}
#fmsg{margin:0;min-height:0;font-size:13px;color:#8A5570;text-align:center}#fmsg:empty{display:none}
#flist h3{margin:14px 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#8A5570;font-weight:700}
#flist .none{margin:6px 0 0;color:#8A5570;font-size:14px;text-align:center}
.frow{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #F5D3E0}
.frow:first-of-type{border-top:0}
.fav{flex:none;width:40px;height:40px;border-radius:50%;background:#fff;display:grid;place-items:center;font-size:22px}
.fn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fn b{display:block;font-weight:700;font-size:15px;overflow:hidden;text-overflow:ellipsis}.fn small{display:block;font-size:12px;color:#8A5570}
.fb{padding:8px 14px;border:1.5px solid #E7B1C6;border-radius:12px;background:#fff;color:#8E0F45;font:700 13px Manrope,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
.fb.ok{border-color:#C2185B;background:#C2185B;color:#fff}
.fb.rm{width:32px;height:32px;padding:0;border-radius:50%;border-color:transparent;background:#F7E1EA;color:#8A5570;font-size:13px}
.facc{margin:16px 0 0;text-align:center;font-size:13px;color:#8A5570}
.facc.ok b{color:#1F6B3A}.facc.ok .em{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis}
.facc.ok .fb{margin-top:8px;padding:6px 12px;font-size:12px}
.facc.warn{padding:14px;border-radius:20px;background:#FFF1F6;border:1.5px dashed #E7B1C6;color:#4A1236}
.facc.warn b{display:block;margin-bottom:2px;font-size:15px}.facc.warn .btn{width:100%;margin-top:10px}
#finv{position:fixed;left:0;right:0;top:0;z-index:60;display:grid;gap:6px;padding:max(8px,env(safe-area-inset-top)) 10px 0;pointer-events:none}
.fban,.ftarget{pointer-events:auto;display:flex;align-items:center;gap:8px;max-width:480px;width:100%;margin:0 auto;padding:10px 12px;border-radius:18px;background:#fff;color:#4A1236;box-shadow:0 12px 30px -10px rgba(74,18,54,.55);font:600 14px/1.3 Manrope,system-ui,sans-serif}
.fban span,.ftarget span{flex:1}
.ftoast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:70;max-width:90vw;padding:10px 16px;border-radius:12px;background:#4A1236;color:#fff;font:500 14px Manrope,system-ui,sans-serif;text-align:center}`;
  document.head.appendChild(css);

  const label = o => ((o && o.avatar) ? o.avatar + ' ' : '') + ((o && o.name) || 'Без имени');
  const who = uid => label(U[uid] && U[uid].name ? U[uid] : list[uid]);
  const parts = uid => { const o = (U[uid] && U[uid].name ? U[uid] : list[uid]) || {}; return { av: o.avatar || '🙂', nm: o.name || 'Без имени' }; };
  F.toast = msg => {
    let t = document.querySelector('.ftoast'); if (!t) { t = document.createElement('div'); t.className = 'ftoast'; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 2600);
  };
  const say = m => { const e = $('#fmsg'); if (e) e.textContent = m || ''; };

  async function ensureCode() {
    const u = (await db.ref('users/' + me).once('value')).val() || {};
    if (u.code) { myCode = u.code; return; }
    for (let i = 0; i < 8; i++) {
      const c = Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
      const r = await db.ref('codes/' + c).transaction(x => x === null ? me : undefined);
      if (r.committed) { myCode = c; await db.ref('users/' + me).update({ code: c, name: P.name() || null, avatar: P.avatar() || null }); return; }
    }
    throw new Error('code');
  }

  const fetchUser = uid => {
    if (U[uid]) return; U[uid] = {};
    db.ref('users/' + uid).once('value').then(s => { U[uid] = s.val() || {}; render(); }).catch(() => {});
  };

  function badge() {
    const n = Object.keys(list).filter(u => list[u].status === 'in').length;
    const b = $('#fr'); if (b) { b.textContent = '👥 Друзья'; if (n) { const i = document.createElement('i'); i.className = 'bdg'; i.textContent = n; b.appendChild(i); } }
  }

  function banner(key, v, ref) {
    if (dlg && dlg.open) dlg.close();
    let box = $('#finv'); if (!box) { box = document.createElement('div'); box.id = 'finv'; document.body.appendChild(box); }
    const d = document.createElement('div'); d.className = 'fban'; d.id = 'inv-' + key;
    d.innerHTML = `<span>${esc(label(v))} зовёт вас играть: «${esc(PAGES[v.page])}»</span><button class="fb ok" type="button">Играть</button><button class="fb" type="button" aria-label="Закрыть">✕</button>`;
    const [go, no] = d.querySelectorAll('button');
    go.onclick = () => { Promise.resolve(ref.remove()).finally(() => { location.href = new URL(v.page + '.html#room=' + v.room, location.href).href; }); };
    no.onclick = () => ref.remove();
    box.appendChild(d);
  }

  function listen() {
    if (window.Stats) Stats.load().then(render).catch(() => {});
    db.ref('friends/' + me).on('value', s => { list = s.val() || {}; Object.keys(list).forEach(fetchUser); render(); badge(); }, () => {});
    const inv = db.ref('invites/' + me);
    inv.on('child_added', s => {
      const v = s.val() || {};
      if (!PAGES[v.page] || !/^[\w-]+$/.test(v.room || '') || Date.now() - (v.t || 0) > 864e5) { s.ref.remove(); return; }
      banner(s.key, v, s.ref);
    }, () => {});
    inv.on('child_removed', s => { const e = document.getElementById('inv-' + s.key); if (e) e.remove(); });
  }

  async function ensureName() {
    if (P.has()) return true;
    const was = dlg && dlg.open; if (was) dlg.close();
    const ok = await P.ask(); if (was) dlg.showModal();
    return ok;
  }

  async function addByCode(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) return say('Введите код друга');
    if (!(await ensureName())) return say('Сначала укажите своё имя');
    say('Ищем…');
    try {
      const uid = (await db.ref('codes/' + code).once('value')).val();
      if (!uid) return say('Такой код не найден');
      if (uid === me) return say('Это ваш собственный код 🙂');
      const cur = list[uid];
      if (cur && cur.status === 'ok') return say('Вы уже друзья');
      if (cur && cur.status === 'out') return say('Запрос уже отправлен, ждём ответа');
      const up = {}, t = Date.now();
      if (cur && cur.status === 'in') {
        up['friends/' + me + '/' + uid + '/status'] = 'ok'; up['friends/' + uid + '/' + me + '/status'] = 'ok';
      } else {
        const u = (await db.ref('users/' + uid).once('value')).val() || {};
        up['friends/' + me + '/' + uid] = { status: 'out', name: u.name || null, avatar: u.avatar || null, t };
        up['friends/' + uid + '/' + me] = { status: 'in', name: P.name(), avatar: P.avatar() || null, t };
      }
      await db.ref().update(up); ev(cur && cur.status === 'in' ? 'friend_added' : 'friend_request'); F.notify(cur && cur.status === 'in' ? 'accepted' : 'friend', uid);
      const i = $('#fin'); if (i) i.value = '';
      say(cur && cur.status === 'in' ? 'Вы теперь друзья!' : 'Запрос отправлен');
    } catch (e) { say('Не получилось. Проверьте интернет и правила базы.'); }
  }

  const unlink = uid => { const up = {}; up['friends/' + me + '/' + uid] = null; up['friends/' + uid + '/' + me] = null; return db.ref().update(up); };

  let outAsk = false;
  function renderAcc() {
    const e = $('#facc'); if (!e) return;
    if (P.isLinked()) {
      e.className = 'facc ok';
      e.innerHTML = `<b>✓ Профиль сохранён</b>${P.email() ? `<span class="em">${esc(P.email())}</span>` : ''}<button class="fb" type="button" data-a="signout">${outAsk ? 'Точно выйти? Друзья пропадут до входа' : 'Выйти'}</button>`;
    } else {
      e.className = 'facc warn';
      e.innerHTML = `<b>Сохраните профиль</b>Иначе друзья пропадут, если очистить данные сайта.<button class="btn" type="button" data-a="google">Сохранить через Google</button>`;
    }
  }
  function render() {
    try { F.onList && F.onList(); } catch (e) {}
    if (!dlg) return;
    renderAcc();
    $('#fcode').textContent = myCode;
    const g = { in: [], ok: [], out: [] };
    Object.keys(list).forEach(u => (g[list[u].status] || g.out).push(u));
    const score = u => { const c = window.Stats && Stats.score(u); return c && (c.w + c.l + c.d) ? `Счёт ${c.w}:${c.l}` : ''; };
    const row = (u, b, sub) => { const p = parts(u); return `<div class="frow"><span class="fav">${esc(p.av)}</span><span class="fn"><b>${esc(p.nm)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${b}</div>`; };
    const btn = (a, u, t, c) => `<button class="fb ${c || ''}" type="button" data-a="${a}" data-u="${esc(u)}"${c === 'rm' ? ' aria-label="Убрать"' : ''}>${t}</button>`;
    const multi = [g.in, g.ok, g.out].filter(x => x.length).length > 1;
    const head = t => multi ? `<h3>${t}</h3>` : '';
    let h = '';
    if (g.in.length) h += head('Хотят дружить') + g.in.map(u => row(u, btn('accept', u, 'Принять', 'ok') + btn('remove', u, '✕', 'rm'), 'Хочет дружить')).join('');
    if (g.ok.length) h += head('Друзья') + g.ok.map(u => row(u, btn('invite', u, 'Играть', 'ok') + btn('remove', u, '✕', 'rm'), score(u))).join('');
    if (g.out.length) h += head('Ждём ответа') + g.out.map(u => row(u, btn('remove', u, 'Отменить'), 'Ждём ответа')).join('');
    $('#flist').innerHTML = h || '<p class="none">Пока никого. Отправьте код другу.</p>';
  }

  const shareUrl = () => new URL('index.html#add=' + myCode, location.href).href;
  const shareText = () => 'Добавь меня в друзья в «Во что сыграем?». Мой код: ' + myCode;

  function dialog() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog'); dlg.id = 'fdlg';
    dlg.innerHTML = `<button class="x" type="button" data-a="close" aria-label="Закрыть">✕</button><h2>Друзья</h2>
<div class="fcard sec"><div><div class="flab">Ваш код</div><div class="fcode" id="fcode"></div></div>
<div class="two"><button class="fb" type="button" data-a="copy">Копировать</button><button class="fb" type="button" data-a="share">Поделиться</button></div></div>
<div class="sec"><div class="fadd"><input class="link" id="fin" placeholder="Код друга" maxlength="10" autocapitalize="characters" autocomplete="off" aria-label="Код друга"><button class="fb ok" type="button" data-a="add" style="padding:0 18px">Добавить</button></div><p id="fmsg"></p></div>
<div id="flist"></div>
<div class="facc" id="facc"></div>`;
    document.body.appendChild(dlg);
    dlg.onclick = async e => {
      if (e.target === dlg) { const r = dlg.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close(); return; }
      const b = e.target.closest('button'); if (!b || !b.dataset.a) return;
      const a = b.dataset.a, u = b.dataset.u;
      try {
        if (a === 'close') dlg.close();
        else if (a === 'copy') { try { await navigator.clipboard.writeText(myCode); } catch (_) { const i = $('#fcode'); getSelection().selectAllChildren(i); document.execCommand('copy'); } say('Код скопирован'); }
        else if (a === 'share') { if (navigator.share) { try { await navigator.share({ title: 'Во что сыграем?', text: shareText(), url: shareUrl() }); } catch (_) {} } else { await navigator.clipboard.writeText(shareText() + ' ' + shareUrl()); say('Ссылка скопирована'); } }
        else if (a === 'add') await addByCode($('#fin').value);
        else if (a === 'accept') { await ensureName(); const up = {}; up['friends/' + me + '/' + u + '/status'] = 'ok'; up['friends/' + u + '/' + me + '/status'] = 'ok'; await db.ref().update(up); ev('friend_added'); F.notify('accepted', u); }
        else if (a === 'remove') await unlink(u);
        else if (a === 'google') {
          say('Открываем вход…');
          const r = await P.linkGoogle();
          if (r === 'switched') {
            const u = (await firebase.database().ref('users/' + firebase.auth().currentUser.uid).once('value')).val() || {};
            if (u.name) P.save(u.name, u.avatar || '');
            say('Профиль найден, загружаем…'); setTimeout(() => location.reload(), 600);
          } else { ev('profile_saved'); say('Профиль сохранён ✓'); renderAcc(); }
        }
        else if (a === 'signout') {
          if (!outAsk) { outAsk = true; renderAcc(); return; }
          await P.signOut(); location.reload();
        }
        else if (a === 'invite') { target = { uid: u, name: who(u) }; dlg.close(); showTarget(); }
      } catch (err) { say(a === 'google' ? P.authError(err) : 'Не получилось. Проверьте интернет и правила базы.'); }
    };
    dlg.querySelector('#fin').onkeydown = e => { if (e.key === 'Enter') addByCode(e.target.value); };
    return dlg;
  }

  function showTarget() {
    hideTarget(); let box = $('#finv'); if (!box) { box = document.createElement('div'); box.id = 'finv'; document.body.appendChild(box); }
    bar = document.createElement('div'); bar.className = 'ftarget';
    bar.innerHTML = `<span>Выберите игру, и мы позовём: ${esc(target.name)}</span><button class="fb" type="button" aria-label="Отмена">✕</button>`;
    bar.querySelector('button').onclick = () => F.clearTarget(); box.prepend(bar);
  }
  const hideTarget = () => { if (bar) { bar.remove(); bar = null; } };

  // Друзья, с которыми уже дружим (для окна «Комната для двоих»)
  F.friends = () => Object.keys(list).filter(u => list[u].status === 'ok').map(u => ({ uid: u, ...parts(u) }));
  F.inviteTo = (uid, page, room) => { target = { uid, name: who(uid) }; return F.sendInvite(page, room).finally(() => { target = null; }); };
  F.target = () => target;
  F.clearTarget = () => { target = null; hideTarget(); };
  // Уведомление на телефон друга (через Cloudflare Worker, адрес в firebase-config.js → PUSH_URL)
  F.notify = async (type, to, key) => {
    const url = window.PUSH_URL; if (!url || !to) return;
    try {
      const u = firebase.auth().currentUser; if (!u) return;
      const tok = await u.getIdToken();
      const c = new AbortController(), tm = setTimeout(() => c.abort(), 5000);
      await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ type, to, key }), signal: c.signal });
      clearTimeout(tm);
    } catch (e) {}
  };
  F.sendInvite = (page, room) => {
    ev('invite_sent', { game: String(page).replace(/\.html$/, '') });
    const to = target.uid;
    const ref = db.ref('invites/' + to).push({ from: me, name: P.name() || null, avatar: P.avatar() || null, page: String(page).replace(/\.html$/, ''), room, t: Date.now() });
    // ждём отправку уведомления не дольше 1.5 с, чтобы не задерживать переход в игру
    return Promise.resolve(ref).then(() => Promise.race([F.notify('invite', to, ref.key), new Promise(r => setTimeout(r, 1500))]));
  };

  F.open = async function () {
    if (!ready) F.init();
    await ready;
    if (F.off) return F.toast('Друзья пока недоступны: включите анонимный вход и обновите правила базы');
    dialog(); render(); say(''); dlg.showModal(); try { document.activeElement.blur(); } catch (e) {}
  };

  F.init = function () {
    if (ready) return ready;
    ready = P.init().then(uid => {
      if (!uid) throw new Error('noauth');
      db = firebase.database(); me = uid; return ensureCode();
    }).then(() => {
      listen();
      const m = location.hash.match(/add=([A-Za-z0-9]{4,10})/);
      if (m) { history.replaceState(null, '', location.pathname + location.search); F.open().then(() => { $('#fin').value = m[1].toUpperCase(); addByCode(m[1]); }); }
    }).catch(() => { F.off = true; });
    return ready;
  };
})();
