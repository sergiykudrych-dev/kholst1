/* Бот @twosomegames_bot: отвечает на личные сообщения приветствием и кнопкой «Играть».
   Секреты (BOT_TOKEN, SECRET) хранятся в настройках Worker, в коде их нет. */
const GAME_URL = 'https://twosome.games/?from=telegram';
const ORIGINS = ['https://twosome.games', 'https://www.twosome.games'];
const enc = new TextEncoder();
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = s => b64u(enc.encode(s));
const hmac = async (key, data) => crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), enc.encode(data));
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

/* Custom token для Firebase: JWT, подписанный ключом сервисного аккаунта. */
async function firebaseToken(uid, env) {
  const raw = String(env.FB_PRIVATE_KEY || ''), m = raw.match(/-----BEGIN[^-]*-----([\s\S]*?)-----END/);
  const pem = (m ? m[1] : raw).replace(/\\n/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64uStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64uStr(JSON.stringify({
    iss: env.FB_CLIENT_EMAIL, sub: env.FB_CLIENT_EMAIL, aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now, exp: now + 3600, uid, claims: { tg: true }
  }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + body));
  return head + '.' + body + '.' + b64u(sig);
}

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
        const token = await firebaseToken('tg_' + user.id, env);
        return new Response(JSON.stringify({ token, name: String(user.first_name || '').slice(0, 20) }), { headers: { ...cors, 'content-type': 'application/json' } });
      } catch (e) { return new Response(JSON.stringify({ error: 'key', why: String((e && e.message) || e).slice(0, 80) }), { status: 500, headers: cors }); }
    }

    if (url.pathname === '/hook' && req.method === 'POST') {
      if (!env.SECRET || req.headers.get('x-telegram-bot-api-secret-token') !== env.SECRET) return new Response('forbidden', { status: 403 });
      let m = null;
      try { m = (await req.json()).message; } catch (e) {}
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
