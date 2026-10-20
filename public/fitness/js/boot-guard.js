// Страховка запуска (обычный скрипт, не модуль). Если приложение не стартовало — например, в кэше
// смешались файлы разных версий, — один раз сами сбрасываем кэш программы и перезагружаемся.
// Данные (IndexedDB) это не трогает. Если не помогло — показываем кнопку.
(function () {
  var KEY = 'fit:repair';
  var done = false;

  async function clearAppCache() {
    try {
      var regs = await navigator.serviceWorker.getRegistrations();
      for (var i = 0; i < regs.length; i++) await regs[i].unregister();
    } catch (e) { /* нет service worker */ }
    try {
      var keys = await caches.keys();
      for (var j = 0; j < keys.length; j++) if (keys[j].indexOf('fit-') === 0) await caches.delete(keys[j]);
    } catch (e) { /* нет Cache API */ }
  }

  function fail() {
    if (done || window.__fitStarted) return;
    done = true;
    var tried = false;
    try { tried = sessionStorage.getItem(KEY) === '1'; sessionStorage.setItem(KEY, '1'); } catch (e) { tried = true; }
    if (!tried) { clearAppCache().then(function () { location.reload(); }); return; }
    var main = document.getElementById('main');
    if (!main) return;
    main.innerHTML = '<div class="view boot-fail"><h1>Не загрузилось</h1>'
      + '<p class="muted">Похоже, браузер держит старую версию трекера. Данные на телефоне не пострадают.</p>'
      + '<button class="btn primary wide" type="button">Обновить трекер</button></div>';
    main.querySelector('button').addEventListener('click', function () {
      clearAppCache().then(function () { location.reload(); });
    });
  }

  window.addEventListener('error', function () { if (!window.__fitStarted) setTimeout(fail, 300); });
  setTimeout(fail, 10000);
  window.addEventListener('load', function () { if (window.__fitStarted) try { sessionStorage.removeItem(KEY); } catch (e) { /* нет хранилища */ } });
})();
