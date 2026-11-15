/* Бот @twosomegames_bot: отвечает на личные сообщения приветствием и кнопкой «Играть».
   Секреты (BOT_TOKEN, SECRET) хранятся в настройках Worker, в коде их нет. */
const GAME_URL = 'https://twosome.games/?from=telegram';
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
