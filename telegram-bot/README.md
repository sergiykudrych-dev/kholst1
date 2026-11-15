# Бот @twosomegames_bot (Cloudflare Worker)

Отвечает на личные сообщения боту приветствием и кнопкой «Играть». Это отдельная программа: на сайт (GitHub Pages) она не влияет.

## Подключение
1. Cloudflare → Workers & Pages → Create → Import a repository → этот репозиторий. Root directory: `telegram-bot`, имя: `twosome-bot`.
2. Settings → Variables and Secrets (тип Secret): `BOT_TOKEN` (токен от @BotFather) и `SECRET` (любая строка из латинских букв, цифр, `_`, `-`).
3. Один раз открыть `https://twosome-bot.<аккаунт>.workers.dev/setup?key=<SECRET>` — ответ `{"ok":true,...}`.
4. Написать боту `/start`.

Токен и SECRET в репозиторий не добавлять.
