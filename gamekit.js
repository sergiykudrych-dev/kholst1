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
