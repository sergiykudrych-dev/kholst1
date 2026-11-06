/* Показывает версию и сравнивает с той, что сейчас лежит на сервере. Использование: Ver.mount(элемент) */
window.Ver = { mount(el) {
  const have = window.SITE_VERSION || '?';
  el.textContent = 'версия ' + have;
  fetch('version.js?t=' + Date.now(), { cache: 'no-store' }).then(r => r.text()).then(t => {
    const m = t.match(/SITE_VERSION='([^']+)'/);
    if (m && m[1] !== have) {
      el.textContent = 'версия ' + have + ' · есть новее (' + m[1] + ') ';
      const a = document.createElement('a'); a.href = '#'; a.textContent = 'обновить'; a.style.cssText = 'color:inherit;font-weight:700;text-decoration:underline';
      a.onclick = e => { e.preventDefault(); const u = new URL(location.href); u.searchParams.set('v', Date.now()); location.replace(u.toString()); };
      el.appendChild(a);
    } else if (m) el.textContent = 'версия ' + have + ' ✓ последняя';
  }).catch(() => {});
} };
