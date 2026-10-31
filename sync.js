'use strict';
(function () {
  const cfg = window.FIREBASE_CONFIG || {}, shareBtn = $('#share');
  if (!window.firebase || !/^https:\/\//.test(cfg.databaseURL || '')) {
    shareBtn.disabled = true; toast('Без синхронизации: заполните firebase-config.js'); return;
  }
  let room = (location.hash.match(/room=([\w-]+)/) || [])[1];
  if (!room) { room = uid() + uid() + uid(); history.replaceState(null, '', '#room=' + room); }
  addEventListener('hashchange', () => location.reload());

  firebase.initializeApp(cfg);
  const box = firebase.database().ref('rooms/' + room + '/objs'), known = {};
  const canon = o => JSON.stringify(o, Object.keys(o).sort());
  const ser = o => {
    const r = {}; for (const k in o) if (k !== 'img' && o[k] !== undefined) r[k] = o[k];
    if (r.p) r.p = r.p.map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]);
    return r;
  };
  const apply = s => {
    const v = s.val(), id = s.key, j = canon(v);
    if (known[id] === j || (drag && sel && sel.id === id)) return;
    known[id] = j;
    const o = { ...v, id }, i = objs.findIndex(x => x.id === id);
    if (o.t === 'img') {
      if (i >= 0 && objs[i].src === o.src) o.img = objs[i].img;
      else { o.img = new Image(); o.img.onload = render; o.img.src = o.src; }
    }
    i < 0 ? objs.push(o) : (objs[i] = o);
    if (sel && sel.id === id) sel = o;
    objs.sort((a, b) => a.ts - b.ts); render();
  };
  box.on('child_added', apply);
  box.on('child_changed', apply);
  box.on('child_removed', s => {
    delete known[s.key]; const i = objs.findIndex(x => x.id === s.key); if (i < 0) return;
    if (sel && sel.id === s.key) sel = null; objs.splice(i, 1); render();
  });
  syncLocal = () => {
    const ids = {};
    objs.forEach(o => {
      if (o.priv) return;
      ids[o.id] = 1; const s = ser(o), j = canon(s);
      if (known[o.id] !== j) { known[o.id] = j; box.child(o.id).set(s); }
    });
    for (const id in known) if (!ids[id]) { delete known[id]; box.child(id).remove(); }
  };
  shareBtn.onclick = async () => {
    if (location.protocol === 'file:') return toast('Ссылка заработает после публикации сайта');
    try {
      if (navigator.share) await navigator.share({ title: 'Холст', url: location.href });
      else { await navigator.clipboard.writeText(location.href); toast('Ссылка скопирована — отправьте её'); }
    } catch (e) { if (e.name !== 'AbortError') prompt('Скопируйте ссылку:', location.href); }
  };
})();
