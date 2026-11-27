/* Бот @twosomegames_bot: отвечает на личные сообщения приветствием и кнопкой «Играть».
   Секреты (BOT_TOKEN, SECRET) хранятся в настройках Worker, в коде их нет. */
const GAME_URL = 'https://twosome.games/?from=telegram';
const ORIGINS = ['https://twosome.games', 'https://www.twosome.games'];
const FB_KEY = 'AIzaSyBCmWiGXM0DoryqSfLDYYW5Ou8rgTKUY3s';   // публичный ключ сайта (он же в firebase-config.js)
const DB = 'https://kholst-1f465-default-rtdb.firebaseio.com';
const GAMES = { tictactoe: 'Крестики-нолики', seabattle: 'Морской бой', truth: 'Правда или действие', number: 'Угадай число', questions: 'Вопросы друг другу', memory: 'Найди пару', monster: 'Создай монстра', chips: 'Чипсы-сюрприз', egg: 'Не урони яйцо', paint: 'Холст', word: 'Угадай слово' };
const enc = new TextEncoder();
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = s => b64u(enc.encode(s));
const hmac = async (key, data) => crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(data));
const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => 'abcdefghjkmnpqrstuvwxyz23456789'[x % 31]).join(''); };
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');

/* Проверка подписи Telegram (initData мини-приложения). Возвращает пользователя или null. */
async function checkInitData(initData, botToken) {
  const p = new URLSearchParams(initData), h = p.get('hash'); p.delete('hash');
  if (!h) return null;
  const str = [...p.entries()].map(([k, v]) => k + '=' + v).sort().join('\n');
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  const sig = hex(await hmac(secret, str));
  if (sig.length !== h.length || sig !== h) return null;
  if (Date.now() / 1000 - Number(p.get('auth_date') || 0) > 86400) return null;
  try { const u = JSON.parse(p.get('user')); return u && u.id ? u : null; } catch (e) { return null; }
}

/* Подпись JWT ключом сервисного аккаунта (RS256). */
async function signJwt(payload, env) {
  const raw = String(env.FB_PRIVATE_KEY || ''), m = raw.match(/-----BEGIN[^-]*-----([\s\S]*?)-----END/);
  const pem = (m ? m[1] : raw).replace(/\\n/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const head = b64uStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), body = b64uStr(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + body));
  return head + '.' + body + '.' + b64u(sig);
}

/* Custom token для Firebase: вход на сайт под uid tg_<id>. */
async function firebaseToken(uid, env) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    iss: env.FB_CLIENT_EMAIL, sub: env.FB_CLIENT_EMAIL, aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now, exp: now + 3600, uid, claims: { tg: true }
  }, env);
}

/* Служебный доступ к базе (от имени сервисного аккаунта): чтобы проверить дружбу со стороны получателя
   и вести счётчик сообщений — пользователи эти данные подделать не могут. */
let adminCache = null;
async function adminToken(env) {
  if (adminCache && adminCache.exp > Date.now() + 60e3) return adminCache.token;
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt({
    iss: env.FB_CLIENT_EMAIL, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email'
  }, env);
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + assertion });
  const j = r.ok ? await r.json() : null;
  if (!j || !j.access_token) throw new Error('admin token ' + r.status);
  adminCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return adminCache.token;
}
const adminDb = async (env, path, method = 'GET', body) => {
  const t = await adminToken(env);
  const r = await fetch(DB + '/' + path + '.json?access_token=' + encodeURIComponent(t), method === 'GET' ? {} : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('db ' + r.status);
  return r.json();
};
/* Сколько ждать между сообщениями одной паре и сколько всего можно отправить за час */
const GAP = { invite: 20e3, friend: 864e5, accepted: 864e5 }, PER_HOUR = 20;

const WELCOME = 'Привет! Здесь игры для двоих онлайн 💗\nПравда или действие, Морской бой, Холст, Тест на совпадение и другие.\nНажмите «Играть» и отправьте код партнёру.';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const api = (method, body) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });

    /* Разовая привязка Telegram к этому Worker: открыть /setup?key=<SECRET> */
    if (url.pathname === '/setup' && env.SECRET && url.searchParams.get('key') === env.SECRET) {
      const r = await api('setWebhook', { url: url.origin + '/hook', secret_token: env.SECRET, allowed_updates: ['message'] });
      return new Response(await r.text());
    }

    /* Вход через Telegram: сайт присылает initData, получает токен Firebase (uid = tg_<id>). */
    if (url.pathname === '/auth') {
      const origin = req.headers.get('origin') || '';
      const cors = { 'access-control-allow-origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], 'access-control-allow-headers': 'content-type', 'vary': 'origin' };
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (req.method !== 'POST' || !env.FB_CLIENT_EMAIL || !env.FB_PRIVATE_KEY) return new Response('{"error":"off"}', { status: 404, headers: cors });
      let user = null;
      try { user = await checkInitData(String((await req.json()).initData || ''), env.BOT_TOKEN); } catch (e) {}
      if (!user) return new Response('{"error":"bad"}', { status: 403, headers: cors });
      try {
        let uid = 'tg_' + user.id;
        try { const m = await adminDb(env, 'tgmap/' + user.id); if (typeof m === 'string' && /^[\w-]{6,40}$/.test(m)) uid = m; } catch (e) {}   /* привязан к профилю с сайта: входим под ним */
        const token = await firebaseToken(uid, env);
        return new Response(JSON.stringify({ token, name: String(user.first_name || '').slice(0, 20) }), { headers: { ...cors, 'content-type': 'application/json' } });
      } catch (e) { return new Response(JSON.stringify({ error: 'key', why: String((e && e.message) || e).slice(0, 80) }), { status: 500, headers: cors }); }
    }

    /* Привязка Telegram к профилю с сайта. Шаг 1: сайт (вход через Google) просит одноразовый код. */
    if (url.pathname === '/link/start') {
      const origin = req.headers.get('origin') || '';
      const cors = { 'access-control-allow-origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], 'access-control-allow-headers': 'content-type', 'vary': 'origin' };
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      const out = (code, extra) => new Response(JSON.stringify({ ok: code === 200, ...extra }), { status: code, headers: { ...cors, 'content-type': 'application/json' } });
      if (req.method !== 'POST' || !env.FB_CLIENT_EMAIL || !env.FB_PRIVATE_KEY) return out(404, { error: 'off' });
      let idToken = ''; try { idToken = String((await req.json()).idToken || ''); } catch (e) {}
      let u = null;
      try {
        const lk = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FB_KEY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }) });
        u = lk.ok ? ((await lk.json()).users || [])[0] : null;
      } catch (e) {}
      if (!u) return out(403, { error: 'auth' });
      if (!(u.providerUserInfo || []).length) return out(403, { error: 'anon' });   /* только сохранённый профиль (Google), не временный */
      try {
        const code = rnd(10);
        await adminDb(env, 'tglink/' + code, 'PUT', { u: u.localId, t: Date.now() });
        return out(200, { code });
      } catch (e) { return out(503, { error: 'db' }); }
    }

    /* Вход через Telegram прямо на сайте (без Google). Шаг 1: сайт просит код; шаг 2: человек жмёт «Старт» в боте;
       шаг 3: сайт опрашивает /login/poll и получает токен. */
    if (url.pathname === '/login/start' || url.pathname === '/login/poll') {
      const origin = req.headers.get('origin') || '';
      const cors = { 'access-control-allow-origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], 'access-control-allow-headers': 'content-type', 'vary': 'origin' };
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      const out = (code, extra) => new Response(JSON.stringify({ ok: code === 200, ...extra }), { status: code, headers: { ...cors, 'content-type': 'application/json' } });
      if (req.method !== 'POST' || !env.FB_CLIENT_EMAIL || !env.FB_PRIVATE_KEY) return out(404, { error: 'off' });
      let b = {}; try { b = await req.json(); } catch (e) {}
      try {
        if (url.pathname === '/login/start') {
          const lk = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FB_KEY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: String(b.idToken || '') }) });
          if (!lk.ok) return out(403, { error: 'auth' });
          const code = rnd(10);
          await adminDb(env, 'tglogin/' + code, 'PUT', { t: Date.now() });
          return out(200, { code });
        }
        const code = String(b.code || '');
        if (!/^[a-z0-9]{10}$/.test(code)) return out(400, { error: 'args' });
        const rec = await adminDb(env, 'tglogin/' + code);
        if (!rec || Date.now() - rec.t > 10 * 60e3) { if (rec) await adminDb(env, 'tglogin/' + code, 'DELETE'); return out(410, { error: 'expired' }); }
        if (!rec.tg) return out(200, { pending: true });
        await adminDb(env, 'tglogin/' + code, 'DELETE');
        let uid = 'tg_' + rec.tg;
        try { const m = await adminDb(env, 'tgmap/' + rec.tg); if (typeof m === 'string' && /^[\w-]{6,40}$/.test(m)) uid = m; } catch (e) {}
        return out(200, { token: await firebaseToken(uid, env), name: String(rec.name || '').slice(0, 20) });
      } catch (e) { return out(503, { error: 'db' }); }
    }

    /* Сообщение другу от бота. Вызывает сайт: idToken отправителя проверяется в Firebase,
       отправлять можно только своим друзьям (проверка по базе от имени отправителя). */
    if (url.pathname === '/notify') {
      const origin = req.headers.get('origin') || '';
      const cors = { 'access-control-allow-origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], 'access-control-allow-headers': 'content-type', 'vary': 'origin' };
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      const out = (code, msg) => new Response(JSON.stringify({ ok: code === 200, error: msg || null }), { status: code, headers: cors });
      if (req.method !== 'POST') return out(404, 'off');
      let b = null; try { b = await req.json(); } catch (e) { return out(400, 'json'); }
      const { idToken, type, to, page, room } = b || {};
      if (!idToken || !/^[\w-]{3,40}$/.test(String(to || '')) || !['invite', 'friend', 'accepted'].includes(type)) return out(400, 'args');
      let uid = null;
      try {
        const lk = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FB_KEY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }) });
        uid = lk.ok ? ((await lk.json()).users || [])[0].localId : null;
      } catch (e) {}
      if (!uid) return out(403, 'auth');
      if (uid === to) return out(400, 'self');
      let me = {};
      try {
        /* дружбу проверяем по списку ПОЛУЧАТЕЛЯ: его может менять только он сам (или запрос «хочу дружить») */
        const st = await adminDb(env, 'friends/' + to + '/' + uid + '/status');
        if (type === 'friend' ? st !== 'in' : st !== 'ok') return out(403, 'not friends');
        /* не чаще одного сообщения паре за GAP и не больше PER_HOUR сообщений от одного человека в час */
        const log = (await adminDb(env, 'tgnotify/' + uid)) || {}, now = Date.now(), hour = Math.floor(now / 3600e3);
        const last = (log.pairs || {})[to + '_' + type] || 0;
        if (now - last < GAP[type]) return out(429, 'too often');
        const n = log.h === hour ? (log.n || 0) : 0;
        if (n >= PER_HOUR) return out(429, 'too many');
        await adminDb(env, 'tgnotify/' + uid, 'PATCH', { h: hour, n: n + 1, ['pairs/' + to + '_' + type]: now });
        me = (await adminDb(env, 'users/' + uid)) || {};
      } catch (e) { return out(503, 'check'); }
      let chat = /^tg_\d{1,15}$/.test(to) ? to.slice(3) : null;
      if (!chat) { try { const c = await adminDb(env, 'tgchat/' + to); chat = c && /^\d{1,15}$/.test(String(c)) ? String(c) : null; } catch (e) {} }
      if (!chat) return out(404, 'no telegram');
      const name = String(me.name || 'Друг').replace(/[\u0000-\u001f<>]/g, '').slice(0, 20);
      const av0 = String(me.avatar || '').replace(/[\u0000-\u001f<>\s]/g, '');
      const av = av0.length <= 16 && !/[\p{L}\p{N}]/u.test(av0) ? av0 : '';   /* аватарка — это эмодзи; буквы и длинный текст не пропускаем */
      const who = ((av ? av + ' ' : '') + name).trim();
      let text, btn, link = 'https://twosome.games/';
      if (type === 'invite') {
        if (!/^[a-z0-9-]{2,30}$/.test(String(page || '')) || !/^[\w-]{4,64}$/.test(String(room || ''))) return out(400, 'args');
        text = who + ' зовёт вас сыграть: ' + (GAMES[page] || 'игра для двоих') + ' 💗\nНажмите «Играть», чтобы присоединиться.';
        link += page + '.html?tgroom=' + room + '&from=tginvite'; btn = 'Играть';
      } else if (type === 'friend') { text = who + ' хочет добавить вас в друзья 💗'; link += '?from=tginvite'; btn = 'Открыть'; }
      else { text = who + ' принял(а) вашу заявку: теперь вы друзья ✓'; link += '?from=tginvite'; btn = 'Играть'; }
      const r = await api('sendMessage', { chat_id: Number(chat), text, reply_markup: { inline_keyboard: [[{ text: btn, web_app: { url: link } }]] } });
      return out(r.ok ? 200 : 502, r.ok ? null : 'telegram ' + r.status);
    }

    if (url.pathname === '/hook' && req.method === 'POST') {
      if (!env.SECRET || req.headers.get('x-telegram-bot-api-secret-token') !== env.SECRET) return new Response('forbidden', { status: 403 });
      let m = null;
      try { m = (await req.json()).message; } catch (e) {}
      const sm = m && m.chat && m.chat.type === 'private' && m.from && /^\/start(?:@\w+)?\s+S([a-z0-9]{10})$/.exec(String(m.text || '').trim());
      if (sm) {
        let ok = false;
        try {
          const rec = await adminDb(env, 'tglogin/' + sm[1]);
          if (rec && !rec.tg && Date.now() - rec.t < 10 * 60e3) { await adminDb(env, 'tglogin/' + sm[1], 'PUT', { t: rec.t, tg: m.from.id, name: String(m.from.first_name || '') }); ok = true; }
        } catch (e) {}
        await api('sendMessage', { chat_id: m.chat.id, text: ok ? 'Вход подтверждён ✓ Вернитесь на сайт: он войдёт сам.' : 'Код не подошёл или устарел. Нажмите «Войти через Telegram» на сайте ещё раз.', reply_markup: { inline_keyboard: [[{ text: 'Играть', web_app: { url: GAME_URL } }]] } });
        return new Response('ok');
      }
      const lm = m && m.chat && m.chat.type === 'private' && m.from && /^\/start(?:@\w+)?\s+L([a-z0-9]{10})$/.exec(String(m.text || '').trim());
      if (lm) {
        let ok = false;
        try {
          const rec = await adminDb(env, 'tglink/' + lm[1]);
          if (rec && rec.u && Date.now() - rec.t < 15 * 60e3) {
            await adminDb(env, 'tgmap/' + m.from.id, 'PUT', rec.u);
            await adminDb(env, 'tgchat/' + rec.u, 'PUT', m.from.id);
            ok = true;
          }
          if (rec) await adminDb(env, 'tglink/' + lm[1], 'DELETE');
        } catch (e) {}
        await api('sendMessage', {
          chat_id: m.chat.id, text: ok ? 'Готово: Telegram привязан к вашему профилю ✓\nТеперь друзья и имя одни и те же на сайте и здесь.' : 'Код не подошёл или устарел. Получите новый на сайте: Друзья → Привязать Telegram.',
          reply_markup: { inline_keyboard: [[{ text: 'Играть', web_app: { url: GAME_URL } }]] }
        });
        return new Response('ok');
      }
      if (m && m.chat && m.chat.type === 'private') {
        await api('sendMessage', {
          chat_id: m.chat.id, text: WELCOME,
          reply_markup: { inline_keyboard: [[{ text: 'Играть', web_app: { url: GAME_URL } }]] }
        });
      }
      return new Response('ok');
    }
    return new Response('twosome bot');
  }
};
