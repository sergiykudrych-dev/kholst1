/* Кнопки «Создать комнату» на посадочных страницах: создаём код комнаты и сразу открываем игру хозяином. */
document.querySelectorAll('[data-game]').forEach(b => {
  b.addEventListener('click', e => {
    e.preventDefault();
    const page = b.dataset.game;
    try { if (window.Track) Track.event('room_created', { game: page.replace(/\.html$/, '') }); } catch (x) {}
    const code = [...crypto.getRandomValues(new Uint8Array(10))].map(n => 'abcdefghijkmnpqrstuvwxyz23456789'[n % 32]).join('');
    setTimeout(() => { location.href = page + '#room=' + code + '&host=1'; }, 120);
  });
});
