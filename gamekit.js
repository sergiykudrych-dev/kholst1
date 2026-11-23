/* Общие помощники для игр: имена и аватарки игроков, чип партнёра в шапке, конфетти.
   Подключается после profile.js. После Profile.start(...) вызовите Kit.attach(). */
(function () {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const P = () => window.Profile || { me: 0, names: {}, has: () => false, name: () => '', avatar: () => '' };
  const rec = p => (P().names || {})[p];
  const K = window.Kit = {
    esc,
    nm(p) { const r = rec(p); if (p === P().me && P().has()) return P().name(); return (r && r.name) || 'Игрок ' + p; },
    av(p) { const r = rec(p), a = p === P().me ? P().avatar() : (r && r.avatar); return a || (p === 1 ? '🙂' : '😊'); },
    here(p) { const r = rec(p); return !!(r && (r.uid || r.name) && !r.left); },
    header() {
      const inv = document.getElementById('inv'); if (!inv) return;
      const o = 3 - P().me;
      if (P().me && K.here(o)) { inv.className = 'chip pc has'; inv.innerHTML = '<i>' + esc(K.av(o)) + '</i>' + esc(K.nm(o)) + '<b></b>'; }
      else { inv.className = 'chip'; inv.textContent = 'Пригласить'; }
      K.lobby();
    },
    /* Пока партнёра нет в комнате — карточка посередине экрана «Позовите партнёра». Исчезает сама, когда он зашёл. */
    lobby() {
      const p = P(), o = 3 - p.me;
      let card = document.getElementById('kl');
      const alone = p.me && p.room && !K.here(o);
      const skipKey = 'kh_lobby_' + p.room;
      let skipped = false; try { skipped = sessionStorage.getItem(skipKey) === '1'; } catch (e) {}
      const inv = document.getElementById('inv');
      if (inv) inv.classList.toggle('kl-pulse', !!alone && skipped);
      if (!alone || skipped) { if (card) card.remove(); clearTimeout(K._lt); K._lt = 0; return; }
      if (card || K._lt) return;
      /* ждём, пока подгрузится список игроков, чтобы карточка не мигала у пары, которая уже вместе */
      K._lt = setTimeout(() => {
        K._lt = 0;
        if (P().pubReady && P().pub === undefined) { K._lt = 1; P().pubReady.then(() => { K._lt = 0; K.lobby(); }); return; }
        if (document.getElementById('kl') || !P().me || K.here(3 - P().me)) return;
        try { if (sessionStorage.getItem(skipKey) === '1') return; } catch (e) {}
        K.css();
        const rec0 = rec(3 - P().me), wasHere = !!(rec0 && rec0.left);
        const pub = !wasHere && P().me === 1 && P().pub && Date.now() - (P().pub.t || 0) < (P().openTTL || 9e5);
        const c = document.createElement('div'); c.id = 'kl';
        c.innerHTML = '<div class="kl-card" role="dialog" aria-live="polite">' +
          '<div class="kl-ic">' + (pub ? '🌍' : '💌') + '</div>' +
          (pub ? '<h2>Комната открыта — ждём игрока</h2><p>Её видно в «Открытых комнатах» 15 минут. Зайдёт любой желающий, а можно позвать и своего:</p>' : wasHere
            ? '<h2><span data-noi18n>' + esc((rec0.avatar ? rec0.avatar + ' ' : '') + (rec0.name || '')) + '</span> <span>вышел(а) из игры</span></h2><p>Отправьте приглашение ещё раз, чтобы продолжить</p>'
            : '<h2>В комнате пока только вы 💗</h2><p>Отправьте ссылку партнёру — игра начнётся, как только он её откроет</p>') +
          '<button class="kl-go" type="button">Отправить приглашение</button>' +
          '<button class="kl-skip" type="button">Осмотрюсь пока</button></div>';
        c.querySelector('.kl-go').onclick = () => { try { window.Track && Track.event('lobby_invite'); } catch (e) {} K.share(); };
        c.querySelector('.kl-skip').onclick = () => { try { sessionStorage.setItem(skipKey, '1'); } catch (e) {} c.remove(); K.lobby(); };
        document.body.appendChild(c);
      }, 1500);
    },
    /* Приглашение: в Telegram — выбор чата, иначе — как кнопка «Пригласить» в шапке (меню «Поделиться» или копия ссылки) */
    share() {
      const p = P(), url = location.origin + location.pathname + '#room=' + p.room;
      const tg = window.Telegram && Telegram.WebApp;
      if (tg && tg.initData && tg.openTelegramLink) {
        const txt = (window.T || (s => s))('Сыграем вдвоём? 💗');
        tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(txt));
        return;
      }
      const inv = document.getElementById('inv'); if (inv) inv.click();
    },
    css() {
      if (document.getElementById('kl-css')) return;
      const s = document.createElement('style'); s.id = 'kl-css';
      s.textContent = '#kl{position:fixed;left:0;right:0;bottom:0;top:calc(max(10px,env(safe-area-inset-top)) + 54px);z-index:45;display:grid;place-items:center;padding:20px 20px 60px;background:rgba(74,18,54,.28);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);pointer-events:none;animation:klf .25s ease}' +
        '.kl-card{pointer-events:auto;width:100%;max-width:380px;padding:26px 22px 16px;border-radius:30px;background:#fff;text-align:center;box-shadow:0 24px 60px -12px rgba(74,18,54,.45);font-family:Manrope,system-ui,sans-serif;color:#4A1236;animation:klu .35s cubic-bezier(.2,.8,.3,1.2)}' +
        '.kl-ic{font-size:46px;line-height:1;margin-bottom:10px}.kl-card h2{margin:0 0 8px;font-size:22px;line-height:1.2;font-weight:800}.kl-card p{margin:0 0 18px;font-size:15px;line-height:1.4;color:#7A4260}' +
        '.kl-go{display:block;width:100%;border:0;border-radius:18px;padding:16px;background:#C2185B;color:#fff;font:800 17px Manrope,system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 24px -8px rgba(194,24,91,.7)}' +
        '.kl-skip{margin-top:8px;border:0;background:none;padding:10px;color:#9B6A84;font:600 14px Manrope,system-ui,sans-serif;cursor:pointer}' +
        '.kl-pulse{animation:klp 1.6s ease-in-out infinite;background:#C2185B!important;color:#fff!important}' +
        '@keyframes klf{from{opacity:0}}@keyframes klu{from{opacity:0;transform:translateY(16px) scale(.96)}}@keyframes klp{50%{box-shadow:0 0 0 8px rgba(194,24,91,.18)}}' +
        '@media (prefers-reduced-motion:reduce){#kl,.kl-card,.kl-pulse{animation:none}}';
      document.head.appendChild(s);
    },
    attach() {
      const p = window.Profile; if (!p) return;
      const n = p.notify;
      p.notify = function () { if (n) n.apply(this, arguments); K.header(); };
      K.header();
    },
    burst(x, y, n) {
      try {
        if (window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches) return;
        const cols = ['#E8548C', '#C2185B', '#F5B400', '#7B4DFF', '#1DA597', '#FF7A3D'];
        for (let i = 0; i < (n || 30); i++) {
          const d = document.createElement('i'), a = Math.random() * Math.PI * 2, v = 90 + Math.random() * 230;
          d.style.cssText = 'position:fixed;z-index:90;pointer-events:none;left:' + x + 'px;top:' + y + 'px;width:' + (10 + Math.random() * 7) + 'px;height:' + (15 + Math.random() * 9) + 'px;border-radius:3px;background:' + cols[i % cols.length];
          document.body.appendChild(d);
          const an = d.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * v + 'px,' + (Math.sin(a) * v + 170) + 'px) rotate(' + (Math.random() * 720 - 360) + 'deg)', opacity: 0 }], { duration: 1000 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.4,1)' });
          an.onfinish = () => d.remove();
        }
      } catch (e) {}
    }
  };
})();
