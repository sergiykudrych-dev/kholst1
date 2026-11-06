/* Статистика игрока: история партий, счёт с друзьями, серии побед. */
(function () {
  'use strict';
  const P = window.Profile; if (!P) return;
  const GAMES = { tictactoe: 'Крестики-нолики', number: 'Угадай число', memory: 'Найди пару', egg: 'Не урони яйцо', chips: 'Чипсы-сюрприз', word: 'Угадай слово', monster: 'Создай монстра' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = s => document.querySelector(s);
  const St = window.Stats = {};
  let hist = [], dlg = null;

  const css = document.createElement('style');
  css.textContent = `#sdlg{max-height:88dvh;overflow:auto}
.stop{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0 4px}
.stop div{padding:10px 4px;border-radius:16px;background:#fff;text-align:center}
.stop b{display:block;font:700 24px/1.1 Manrope,system-ui,sans-serif;color:#8E0F45}
.stop span{font-size:12px;color:#8A5570}
#sdlg h3{margin:16px 0 4px;font-size:13px;color:#8A5570;font-weight:700}
.srow{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #F3B6CC;font-size:14px}
.srow .sn{flex:1;min-width:0;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.srow .sv{color:#8A5570;white-space:nowrap}.srow .sv b{color:#8E0F45}`;
  document.head.appendChild(css);

  St.load = function () {
    return P.init().then(uid => {
      if (!uid) throw new Error('noauth');
      return firebase.database().ref('history/' + uid).once('value');
    }).then(s => {
      const v = s.val() || {};
      hist = Object.keys(v).map(k => Object.assign({ id: k }, v[k])).sort((a, b) => (a.t || 0) - (b.t || 0));
      return hist;
    });
  };
  St.score = uid => {
    const r = { w: 0, l: 0, d: 0, coop: 0, n: 0 };
    hist.forEach(x => { if (x.opp !== uid) return; if (x.res === 'win') r.w++; else if (x.res === 'loss') r.l++; else if (x.res === 'draw') r.d++; else r.coop++; r.n++; });
    return r;
  };

  function calc() {
    const duel = hist.filter(x => x.res === 'win' || x.res === 'loss' || x.res === 'draw');
    const t = { n: hist.length, w: 0, l: 0, d: 0, cur: 0, best: 0, games: {}, opps: {} };
    let run = 0;
    duel.forEach(x => { if (x.res === 'win') { t.w++; run++; t.best = Math.max(t.best, run); } else { if (x.res === 'loss') t.l++; else t.d++; run = 0; } });
    t.cur = run;
    hist.forEach(x => {
      const g = t.games[x.game] || (t.games[x.game] = { n: 0, w: 0, l: 0, d: 0, coop: 0 });
      g.n++; if (x.res === 'win') g.w++; else if (x.res === 'loss') g.l++; else if (x.res === 'draw') g.d++; else g.coop++;
      if (!x.opp) return;
      const o = t.opps[x.opp] || (t.opps[x.opp] = { n: 0, w: 0, l: 0, d: 0, coop: 0 });
      o.name = x.oppName || o.name; o.avatar = x.oppAvatar || o.avatar;
      o.n++; if (x.res === 'win') o.w++; else if (x.res === 'loss') o.l++; else if (x.res === 'draw') o.d++; else o.coop++;
    });
    return t;
  }

  const ICON = { win: '🏆', loss: '💔', draw: '🤝', coop: '💞' };
  const date = t => t ? new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '';
  function render() {
    const t = calc(), me = ((P.avatar() || '') + ' ' + (P.name() || 'Вы')).trim();
    const duels = t.w + t.l + t.d;
    if (!t.n) { $('#sbody').innerHTML = '<p class="hint">Пока нет сыгранных партий. Сыграйте с другом, и здесь появится статистика.</p>'; return; }
    const pct = duels ? Math.round(t.w / duels * 100) + '%' : '—';
    let h = `<div class="stop"><div><b>${t.n}</b><span>партий</span></div><div><b>${pct}</b><span>побед</span></div><div><b>${t.best}</b><span>рекорд серии${t.cur ? ' · сейчас ' + t.cur : ''}</span></div></div>`;
    const opps = Object.keys(t.opps).sort((a, b) => t.opps[b].n - t.opps[a].n).slice(0, 6);
    if (opps.length) h += '<h3>С кем играете</h3>' + opps.map(u => { const o = t.opps[u]; return `<div class="srow"><span class="sn">${esc(((o.avatar || '') + ' ' + (o.name || 'Игрок')).trim())}</span><span class="sv">${o.w + o.l + o.d ? `вы <b>${o.w}:${o.l}</b>${o.d ? ' · ничьих ' + o.d : ''}` : ''}${o.coop ? (o.w + o.l + o.d ? ' · ' : '') + 'вместе ' + o.coop : ''}</span></div>`; }).join('');
    const gk = Object.keys(t.games).sort((a, b) => t.games[b].n - t.games[a].n);
    h += '<h3>Игры</h3>' + gk.map(k => { const g = t.games[k]; return `<div class="srow"><span class="sn">${esc(GAMES[k] || k)}</span><span class="sv">${g.n} · ${g.w + g.l + g.d ? `<b>${g.w}</b> побед` : 'вместе'}</span></div>`; }).join('');
    h += '<h3>Последние партии</h3>' + hist.slice(-8).reverse().map(x => `<div class="srow"><span>${ICON[x.res] || ''}</span><span class="sn">${esc(GAMES[x.game] || x.game)}${x.oppName ? ' · ' + esc(x.oppName) : ''}</span><span class="sv">${date(x.t)}</span></div>`).join('');
    $('#sbody').innerHTML = h;
  }

  St.open = async function () {
    try { window.Track && Track.event('stats_open'); } catch (e) {}
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'sdlg';
      dlg.innerHTML = '<button class="x" type="button" aria-label="Закрыть">✕</button><h2>Статистика</h2><p id="sme"></p><div id="sbody"></div>';
      document.body.appendChild(dlg);
      dlg.onclick = e => { const r = dlg.getBoundingClientRect(); if (e.target.classList.contains('x') || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close(); };
    }
    $('#sme').textContent = ((P.avatar() || '') + ' ' + (P.name() || '')).trim();
    $('#sbody').innerHTML = '<p class="hint">Загружаем…</p>'; dlg.showModal(); try { document.activeElement.blur(); } catch (e) {}
    try { await St.load(); render(); } catch (e) { $('#sbody').innerHTML = '<p class="hint">Статистика недоступна: включите анонимный вход и обновите правила базы.</p>'; }
  };
})();
