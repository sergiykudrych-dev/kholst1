/* Звуки, вибрация, реакции-эмодзи и кнопка «Поделиться» в конце партии.
   Подключается в играх после profile.js. Звук выключается в меню 💗 (хранится в localStorage). */
(function () {
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const F = window.Fx = {};
  const SITE = 'https://twosome.games/';
  let snd = LS.get('kh_snd') !== '0', ctx = null, lastIn = 0;

  /* ——— звук ——— */
  const ac = () => {
    try {
      if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
    return ctx;
  };
  const note = (f, at, d, vol, type) => {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
    o.type = type || 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || .18, t + .02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + .05);
  };
  const vib = p => { if (snd) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} } };
  const doPlay = (name) => {
    if (!snd) return;
    try {
      if (name === 'move') { note(660, 0, .14, .14); note(880, .09, .18, .12); vib(30); }
      else if (name === 'join') { note(523, 0, .16); note(659, .12, .16); note(784, .24, .24); vib([40, 60, 40]); }
      else if (name === 'win') { note(523, 0, .18); note(659, .14, .18); note(784, .28, .18); note(1047, .42, .4, .2); vib([60, 50, 60, 50, 120]); }
      else if (name === 'loss') { note(392, 0, .22, .16, 'triangle'); note(330, .2, .4, .16, 'triangle'); vib(160); }
      else if (name === 'coop') { note(523, 0, .2); note(659, .16, .2); note(784, .32, .2); note(988, .48, .1); note(1047, .56, .5, .2); vib([50, 40, 50, 40, 100]); }
      else if (name === 'react') { note(880, 0, .1, .1); note(1175, .07, .16, .1); vib(25); }
    } catch (e) {}
  };
  F.play = doPlay;
  const play = n => F.play(n);
  const unlock = () => { ac(); };
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, () => { lastIn = Date.now(); unlock(); }, { capture: true, passive: true }));

  /* ——— события игры (вызывает profile.js) ——— */
  let first = true, prevSig = '', prevRes = null;
  F.state = function (v, res) {
    const sig = JSON.stringify(v || null);
    if (first) { first = false; prevSig = sig; prevRes = res || null; return; }
    if (sig === prevSig) return; prevSig = sig;
    const ended = res && !prevRes; prevRes = res || null;
    if (ended) play(res === 'win' ? 'win' : res === 'loss' ? 'loss' : 'coop');
    else if (Date.now() - lastIn > 900) play('move');
  };
  let firstPl = true, hadPartner = false;
  F.players = function (other) {
    const has = !!(other && (other.uid || other.name));
    if (firstPl) { firstPl = false; hadPartner = has; return; }
    if (has && !hadPartner) play('join');
    hadPartner = has;
  };

  /* ——— оформление ——— */
  function css() {
    if (document.getElementById('fx-css')) return;
    const s = document.createElement('style'); s.id = 'fx-css';
    s.textContent = `header{gap:6px}header .chip{white-space:nowrap;padding:9px 11px}header #me{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto}
.fx-b{flex:none;width:40px;height:40px;padding:0!important;display:grid;place-items:center;font-size:18px;line-height:1}
.fx-pop{position:fixed;z-index:70;right:10px;top:max(58px,calc(env(safe-area-inset-top) + 50px));padding:10px;border-radius:20px;background:#fff;box-shadow:0 14px 40px -10px rgba(74,18,54,.5);font-family:Manrope,system-ui,sans-serif}
.fx-pop[hidden]{display:none}
.fx-row{display:flex;gap:6px}
.fx-row button{width:44px;height:44px;border-radius:14px;background:#FFF1F6;font-size:24px;line-height:1;border:0;cursor:pointer}
.fx-row button:active{transform:scale(.9)}
.fx-snd{display:block;width:100%;margin-top:8px;padding:9px;border:0;border-radius:12px;background:none;color:#8A5570;font:700 13px Manrope,system-ui,sans-serif;cursor:pointer}
.fx-fly{position:fixed;z-index:80;bottom:90px;font-size:44px;pointer-events:none;animation:fxup 2.2s ease-out forwards}
.fx-fly small{display:block;text-align:center;font:700 11px Manrope,system-ui,sans-serif;color:#8E0F45;background:rgba(255,255,255,.85);border-radius:8px;padding:1px 6px;margin-top:2px}
@keyframes fxup{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1;transform:translateY(-30px) scale(1.15)}100%{transform:translateY(-320px) scale(1);opacity:0}}
.fx-share{display:block;width:100%;margin-top:12px;padding:11px;border:1.5px solid #C2185B;border-radius:14px;background:none;color:#C2185B;font:700 14px Manrope,system-ui,sans-serif;cursor:pointer}
@media(prefers-reduced-motion:reduce){.fx-fly{animation-duration:.01s}}`;
    document.head.appendChild(s);
  }

  /* ——— реакции ——— */
  const EMO = ['💗', '😂', '🔥', '👏', '😮'];
  function fly(e, who) {
    css();
    const el = document.createElement('div'); el.className = 'fx-fly'; el.textContent = e;
    if (who) { const s = document.createElement('small'); s.textContent = who; el.appendChild(s); }
    el.style.left = (15 + Math.random() * 60) + '%'; document.body.appendChild(el); setTimeout(() => el.remove(), 2400);
  }
  function mountUI() {
    const hd = document.querySelector('header'); if (!hd || document.getElementById('fx-btn')) return;
    css();
    const b = document.createElement('button'); b.type = 'button'; b.id = 'fx-btn'; b.className = 'chip fx-b'; b.textContent = '💗'; b.setAttribute('aria-label', 'Реакции и звук');
    hd.appendChild(b);
    const pop = document.createElement('div'); pop.className = 'fx-pop'; pop.hidden = true;
    pop.innerHTML = '<div class="fx-row">' + EMO.map(e => `<button type="button" data-e="${e}" aria-label="${e}">${e}</button>`).join('') + '</div><button type="button" class="fx-snd"></button>';
    document.body.appendChild(pop);
    const sb = pop.querySelector('.fx-snd'), paint = () => { sb.textContent = snd ? '🔊 Звук включён' : '🔇 Звук выключен'; }; paint();
    b.onclick = e => { e.stopPropagation(); pop.hidden = !pop.hidden; };
    document.addEventListener('click', e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== b) pop.hidden = true; });
    sb.onclick = () => { snd = !snd; LS.set('kh_snd', snd ? '1' : '0'); paint(); if (snd) play('react'); };
    let lastSend = 0;
    pop.querySelector('.fx-row').onclick = e => {
      const x = e.target.closest('button'); if (!x || Date.now() - lastSend < 700) return; lastSend = Date.now();
      const em = x.dataset.e; fly(em); play('react'); pop.hidden = true; send(em);
    };
  }
  let rref = null;
  function send(e) {
    try { if (rref) rref.set({ f: window.Profile ? Profile.me : 0, e, t: firebase.database.ServerValue.TIMESTAMP }).catch(() => {}); } catch (x) {}
  }
  function listen() {
    if (!window.Profile || !Profile.ready || !window.firebase) return;
    Profile.ready.then(() => {
      rref = firebase.database().ref('rooms/' + Profile.room + '/react');
      let init = true;
      rref.on('value', s => {
        const v = s.val();
        if (init) { init = false; return; }
        if (!v || v.f === Profile.me || EMO.indexOf(v.e) < 0) return;
        const o = Profile.names && Profile.names[3 - Profile.me];
        fly(v.e, o && o.name ? o.name : ''); play('react');
      }, () => {});
    }).catch(() => {});
  }

  /* ——— «Поделиться» в конце партии ——— */
  F.shareSite = async function (btn) {
    const data = { title: 'Во что сыграем?', text: 'Игры для двоих онлайн: без регистрации, прямо в браузере', url: SITE };
    try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(SITE); if (btn) { const t = btn.textContent; btn.textContent = 'Ссылка скопирована ✓'; setTimeout(() => btn.textContent = t, 2000); } } catch (e) { prompt('Скопируйте ссылку:', SITE); }
  };
  function endShare() {
    const mo = new MutationObserver(() => {
      const card = document.querySelector('.over .card');
      if (card && !card.querySelector('.fx-share')) {
        css(); const b = document.createElement('button'); b.type = 'button'; b.className = 'fx-share'; b.textContent = 'Понравилось? Отправьте другу ♥';
        b.onclick = () => F.shareSite(b); card.appendChild(b);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  const go = () => { mountUI(); listen(); endShare(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
