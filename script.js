'use strict';
const $ = s => document.querySelector(s);
const cv = $('#c'); let ctx = cv.getContext('2d');
const ICONS = {
  select: 'M5 3l14 7-6 2-2 6z', pen: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3', line: 'M5 19L19 5',
  arrow: 'M5 19L19 5M10 5h9v9', rect: 'M6 6h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z',
  ellipse: 'M12 4a8 8 0 100 16 8 8 0 000-16z', tri: 'M12 4l9 16H3z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  text: 'M5 6V4h14v2M12 4v16M9 20h6', erase: 'M3 17l9-10 7 7-5 5H8zM9 12l6 6',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01', download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13', sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1'
};
document.querySelectorAll('[data-icon]').forEach(b => b.insertAdjacentHTML('afterbegin',
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[b.dataset.icon]}"/></svg>`));

let objs = [], hist = [[]], hi = 0, tool = 'select', sel = null, cur = null, drag = null, txtOpen = null, ht;
const st = { stroke: '#1B1D3A', fill: '#F2B705', sw: 4, op: 100, target: 'fill' };
const COLORS = ['#1B1D3A', '#3B3FD8', '#8E92F5', '#18A0C8', '#1FA56B', '#F2B705', '#FF8A3D', '#FF4F6D', '#B04BDB', '#FFFFFF'];
const LINEAR = ['line', 'arrow'];
const uid = () => Math.random().toString(36).slice(2, 8);
let ME; try { ME = sessionStorage.me || (sessionStorage.me = uid()); } catch (_) { ME = uid(); }
const stamp = o => Object.assign(o, { id: uid() + uid(), by: ME, ts: Date.now() });
let syncLocal = () => {};

/* ---------- отрисовка ---------- */
function fit() {
  const d = devicePixelRatio || 1;
  cv.width = innerWidth * d; cv.height = innerHeight * d;
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  ctx.setTransform(d, 0, 0, d, 0, 0); render();
}
const font = o => `700 ${o.size}px Manrope, system-ui, sans-serif`;
function measure(o) { ctx.save(); ctx.font = font(o); o.w = ctx.measureText(o.text).width; o.h = o.size * 1.25; ctx.restore(); }

function path(o) {
  const { x, y, w, h } = o; ctx.beginPath();
  switch (o.t) {
    case 'rect': ctx.roundRect ? ctx.roundRect(x, y, w, h, Math.min(10, w / 4, h / 4)) : ctx.rect(x, y, w, h); break;
    case 'ellipse': ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 7); break;
    case 'tri': ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? .42 : 1, a = -Math.PI / 2 + i * Math.PI / 5;
        const px = x + w / 2 + Math.cos(a) * r * w / 2, py = y + h / 2 + Math.sin(a) * r * h / 2;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      } ctx.closePath(); break;
    case 'line': case 'arrow': ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); break;
    case 'pen': (o.raw || o.p.map(q => [x + q[0] * w, y + q[1] * h])).forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); break;
  }
}
function draw(o) {
  ctx.save(); ctx.globalAlpha = o.op / 100; ctx.lineJoin = ctx.lineCap = 'round';
  ctx.lineWidth = o.sw; ctx.strokeStyle = o.stroke; ctx.fillStyle = o.fill;
  if (o.t === 'img') ctx.drawImage(o.img, o.x, o.y, o.w, o.h);
  else if (o.t === 'text') { ctx.font = font(o); ctx.textBaseline = 'top'; ctx.fillStyle = o.stroke; ctx.fillText(o.text, o.x, o.y); }
  else {
    path(o);
    if (o.fill !== 'none' && o.t !== 'pen' && !LINEAR.includes(o.t)) ctx.fill();
    ctx.stroke();
    if (o.t === 'arrow') {
      const a = Math.atan2(o.h, o.w), L = 10 + o.sw * 2, ex = o.x + o.w, ey = o.y + o.h;
      ctx.beginPath(); ctx.moveTo(ex - L * Math.cos(a - .45), ey - L * Math.sin(a - .45));
      ctx.lineTo(ex, ey); ctx.lineTo(ex - L * Math.cos(a + .45), ey - L * Math.sin(a + .45)); ctx.stroke();
    }
  }
  ctx.restore();
}
const bbox = o => [Math.min(o.x, o.x + o.w), Math.min(o.y, o.y + o.h), Math.max(o.x, o.x + o.w), Math.max(o.y, o.y + o.h)];
function drawSel(o) {
  const [l, t, r, b] = bbox(o); ctx.save();
  ctx.strokeStyle = '#3B3FD8'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(l - 4, t - 4, r - l + 8, b - t + 8);
  ctx.setLineDash([]); ctx.fillStyle = '#fff';
  if (o.t !== 'text') for (const [px, py] of Object.values(corners(o))) { ctx.beginPath(); ctx.rect(px - 5, py - 5, 10, 10); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
function render() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  objs.forEach(draw); if (cur) draw(cur); if (sel) drawSel(sel);
  $('#empty').classList.toggle('off', !!(objs.length || cur || txtOpen));
}

/* ---------- выбор и изменение размера ---------- */
function corners(o) { const [l, t, r, b] = bbox(o); return { nw: [l - 4, t - 4], ne: [r + 4, t - 4], sw: [l - 4, b + 4], se: [r + 4, b + 4] }; }
function handleAt(o, p) { if (o.t === 'text') return null; for (const [k, c] of Object.entries(corners(o))) if (Math.hypot(p[0] - c[0], p[1] - c[1]) < 14) return k; return null; }
function hit(o, px, py) {
  if (LINEAR.includes(o.t)) {
    const dx = o.w, dy = o.h, t = Math.max(0, Math.min(1, ((px - o.x) * dx + (py - o.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(px - o.x - t * dx, py - o.y - t * dy) <= Math.max(8, o.sw / 2 + 6);
  }
  const m = Math.max(6, o.sw / 2 + 4), [l, t, r, b] = bbox(o);
  return px >= l - m && px <= r + m && py >= t - m && py <= b + m;
}
const pick = p => { for (let i = objs.length - 1; i >= 0; i--) if (hit(objs[i], p[0], p[1])) return objs[i]; return null; };

function resize(d, p) {
  const o = d.o; let [l, t, r, b] = d.bb;
  d.h[1] === 'w' ? l = p[0] : r = p[0]; d.h[0] === 'n' ? t = p[1] : b = p[1];
  if (l > r) [l, r] = [r, l]; if (r - l < 6) r = l + 6;
  if (o.t === 'img') { const nh = (r - l) / d.ar; d.h[0] === 'n' ? t = b - nh : b = t + nh; }
  else { if (t > b) [t, b] = [b, t]; if (b - t < 6) b = t + 6; }
  o.w = d.sx * (r - l); o.x = d.sx > 0 ? l : r; o.h = d.sy * (b - t); o.y = d.sy > 0 ? t : b;
}

/* ---------- указатель ---------- */
const pos = e => [e.clientX, e.clientY];
cv.addEventListener('pointerdown', e => {
  if (e.button > 0) return; cv.setPointerCapture(e.pointerId); const p = pos(e); commitText();
  if (tool === 'select') {
    const h = sel && handleAt(sel, p);
    if (h) { drag = { k: 'size', h, o: sel, bb: bbox(sel), sx: Math.sign(sel.w) || 1, sy: Math.sign(sel.h) || 1, ar: Math.abs(sel.w / sel.h) || 1 }; return; }
    sel = pick(p); if (sel) { drag = { k: 'move', sx: p[0], sy: p[1], ox: sel.x, oy: sel.y }; load(sel); } render(); return;
  }
  if (tool === 'erase') { drag = { k: 'erase' }; erase(p); render(); return; }
  if (tool === 'text') { startText(p); return; }
  sel = null;
  const base = { stroke: st.stroke, fill: st.fill, sw: st.sw, op: st.op, x: p[0], y: p[1], w: 0, h: 0, t: tool };
  cur = tool === 'pen' ? { ...base, raw: [p] } : base; drag = { k: 'draw', sx: p[0], sy: p[1] };
});
cv.addEventListener('pointermove', e => {
  if (!drag) return; const p = pos(e);
  if (drag.k === 'draw') {
    if (cur.t === 'pen') cur.raw.push(p);
    else if (LINEAR.includes(cur.t)) { cur.w = p[0] - drag.sx; cur.h = p[1] - drag.sy; }
    else { cur.x = Math.min(drag.sx, p[0]); cur.y = Math.min(drag.sy, p[1]); cur.w = Math.abs(p[0] - drag.sx); cur.h = Math.abs(p[1] - drag.sy); }
  } else if (drag.k === 'move') { sel.x = drag.ox + p[0] - drag.sx; sel.y = drag.oy + p[1] - drag.sy; drag.moved = true; }
  else if (drag.k === 'size') { resize(drag, p); drag.moved = true; }
  else erase(p);
  render();
});
function endDrag() {
  if (!drag) return; const d = drag; drag = null;
  if (d.k === 'draw' && cur) {
    const o = cur; cur = null;
    if (o.t === 'pen') {
      const r = o.raw; if (r.length === 1) r.push([...r[0]]);
      const xs = r.map(q => q[0]), ys = r.map(q => q[1]), x = Math.min(...xs), y = Math.min(...ys);
      o.x = x; o.y = y; o.w = Math.max(Math.max(...xs) - x, 1); o.h = Math.max(Math.max(...ys) - y, 1);
      o.p = r.map(q => [(q[0] - x) / o.w, (q[1] - y) / o.h]); delete o.raw;
    } else if (Math.abs(o.w) < 4 && Math.abs(o.h) < 4) return render();
    objs.push(stamp(o)); push();
  } else if (d.moved || d.changed) push();
  render();
}
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
function erase(p) { const o = pick(p); if (o) { objs.splice(objs.indexOf(o), 1); drag.changed = true; } }

/* ---------- текст ---------- */
const txt = $('#txt');
function startText(p) {
  txtOpen = { x: p[0], y: p[1], size: 14 + st.sw * 4 };
  Object.assign(txt.style, { left: p[0] + 'px', top: p[1] + 'px', fontSize: txtOpen.size + 'px', color: st.stroke });
  txt.hidden = false; txt.value = ''; setTimeout(() => txt.focus(), 30); render();
}
function commitText() {
  if (!txtOpen) return; const t = txtOpen, v = txt.value.trim(); txtOpen = null; txt.hidden = true;
  if (v) { const o = { t: 'text', text: v, x: t.x, y: t.y, size: t.size, stroke: st.stroke, fill: 'none', sw: st.sw, op: st.op }; measure(o); objs.push(stamp(o)); push(); }
  render();
}
txt.addEventListener('keydown', e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') { txt.value = ''; commitText(); } });
txt.addEventListener('blur', commitText);

/* ---------- история ---------- */
const snap = () => objs.map(o => ({ ...o }));
function push() { hist = hist.slice(0, hi + 1).slice(-99); hist.push(snap()); hi = hist.length - 1; btns(); syncLocal(); }
function go(d) {
  const n = hi + d; if (n < 0 || n >= hist.length) return;
  hi = n; const mine = hist[hi].filter(o => o.by === ME).map(o => ({ ...o }));
  objs = objs.filter(o => o.by !== ME).concat(mine).sort((a, b) => a.ts - b.ts); sel = null; render(); btns(); syncLocal();
}
const btns = () => { $('#undo').disabled = hi === 0; $('#redo').disabled = hi === hist.length - 1; };

/* ---------- панель стиля ---------- */
const sw = $('#sw');
COLORS.forEach(c => sw.insertAdjacentHTML('beforeend', `<button data-c="${c}" style="background:${c}" aria-label="${c}"></button>`));
sw.insertAdjacentHTML('beforeend', '<button data-c="none" class="none" aria-label="Без заливки"></button><label title="Свой цвет"><input type="color" id="custom"></label>');
function ui() {
  for (const k of ['stroke', 'fill']) { const i = $(k === 'stroke' ? '#cs i' : '#cf i'); i.style.background = st[k] === 'none' ? '' : st[k]; i.classList.toggle('none', st[k] === 'none'); }
  $('#cs').classList.toggle('on', st.target === 'stroke'); $('#cf').classList.toggle('on', st.target === 'fill');
  sw.querySelectorAll('button').forEach(b => b.classList.toggle('cur', b.dataset.c.toLowerCase() === String(st[st.target]).toLowerCase()));
  $('#sww').value = st.sw; $('#swv').textContent = st.sw + ' px'; $('#opw').value = st.op; $('#opv').textContent = st.op + '%';
}
function apply() {
  ui(); if (!sel) return;
  Object.assign(sel, { stroke: st.stroke, fill: sel.t === 'text' ? 'none' : st.fill, sw: st.sw, op: st.op });
  if (sel.t === 'text') { sel.size = 14 + st.sw * 4; measure(sel); }
  render(); clearTimeout(ht); ht = setTimeout(push, 500);
}
function load(o) {
  if (o.t === 'img') st.op = o.op;
  else { Object.assign(st, { stroke: o.stroke, fill: o.fill, sw: o.t === 'text' ? (o.size - 14) / 4 : o.sw, op: o.op }); }
  ui();
}
document.querySelectorAll('.chip').forEach(b => b.onclick = () => { st.target = b.dataset.t; ui(); });
sw.onclick = e => { const b = e.target.closest('button'); if (!b) return; st[st.target] = st.target === 'stroke' && b.dataset.c === 'none' ? st.stroke : b.dataset.c; apply(); };
$('#custom').oninput = e => { st[st.target] = e.target.value; apply(); };
$('#sww').oninput = e => { st.sw = +e.target.value; apply(); };
$('#opw').oninput = e => { st.op = +e.target.value; apply(); };
$('#pt').onclick = () => $('#props').classList.toggle('open');

/* ---------- инструменты ---------- */
function setTool(t) {
  commitText(); tool = t;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  cv.style.cursor = t === 'select' ? 'default' : t === 'text' ? 'text' : 'crosshair';
  if (t !== 'select') sel = null; render();
}
document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
$('#undo').onclick = () => go(-1); $('#redo').onclick = () => go(1);

/* ---------- картинки ---------- */
function addImg(src) {
  const im = new Image();
  im.onload = () => {
    const k = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    const s = Math.min(1, 420 / Math.max(c.width, c.height)), w = c.width * s, h = c.height * s;
    const o = stamp({ t: 'img', img: c, src: c.toDataURL('image/jpeg', .78), x: (innerWidth - w) / 2 + objs.length % 5 * 20, y: (innerHeight - h) / 2 + objs.length % 5 * 20, w, h, sw: 0, op: st.op, stroke: '#000', fill: 'none' });
    objs.push(o); setTool('select'); sel = o; push(); render();
  };
  im.src = src;
}
function readFiles(files) {
  [...files].filter(f => f.type.startsWith('image/')).forEach(f => { const r = new FileReader(); r.onload = () => addImg(r.result); r.readAsDataURL(f); });
}
$('#img').onclick = () => $('#file').click();
$('#file').onchange = e => { readFiles(e.target.files); e.target.value = ''; };
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); readFiles(e.dataTransfer.files); });
addEventListener('paste', e => readFiles([...e.clipboardData.files]));

/* ---------- сохранение и удаление ---------- */
let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2200); }
$('#save').onclick = () => {
  if (!objs.length) return toast('Сначала нарисуйте что-нибудь');
  const bs = objs.map(o => { const b = bbox(o), m = o.sw / 2 + (o.t === 'arrow' ? 10 + o.sw * 2 : 0); return [b[0] - m, b[1] - m, b[2] + m, b[3] + m]; });
  const x0 = Math.min(...bs.map(b => b[0])) - 40, y0 = Math.min(...bs.map(b => b[1])) - 40;
  const W = Math.max(...bs.map(b => b[2])) + 40 - x0, H = Math.max(...bs.map(b => b[3])) + 40 - y0;
  const off = document.createElement('canvas'), real = ctx, k = 2; off.width = W * k; off.height = H * k;
  ctx = off.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, off.width, off.height);
  ctx.scale(k, k); ctx.translate(-x0, -y0); objs.forEach(draw); ctx = real;
  const a = document.createElement('a'); a.download = 'holst.png'; a.href = off.toDataURL('image/png'); a.click(); toast('Рисунок сохранён');
};
function remove() {
  if (sel) { objs.splice(objs.indexOf(sel), 1); sel = null; push(); render(); }
  else if (objs.length && confirm('Очистить весь холст?')) { objs = []; push(); render(); }
}
$('#del').onclick = remove;

/* ---------- клавиатура ---------- */
const KEYS = { KeyV: 'select', KeyP: 'pen', KeyL: 'line', KeyA: 'arrow', KeyR: 'rect', KeyO: 'ellipse', KeyG: 'tri', KeyS: 'star', KeyT: 'text', KeyE: 'erase' };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); go(e.shiftKey ? 1 : -1); }
  else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); go(1); }
  else if (e.ctrlKey || e.metaKey || e.altKey) return;
  else if (e.code === 'Delete' || e.code === 'Backspace') remove();
  else if ((e.key === ']' || e.key === '[') && sel) {
    sel.ts = e.key === ']' ? Date.now() : Math.min(...objs.map(o => o.ts)) - 1;
    objs.splice(objs.indexOf(sel), 1); e.key === ']' ? objs.push(sel) : objs.unshift(sel); push(); render();
  } else if (KEYS[e.code]) setTool(KEYS[e.code]);
});

addEventListener('resize', fit);
setTool('select'); ui(); btns(); fit();
