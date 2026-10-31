// Light or dark before the page draws, so it never flashes the wrong colours. The visitor's
// choice (Auto / Light / Dark) is kept in this browser only. A file of its own (not inline),
// so the live site can use a strict Content-Security-Policy.
(function () {
  var pref = 'auto';
  try { pref = localStorage.getItem('nh-theme') || 'auto'; } catch (e) { /* private mode */ }
  var dark = pref === 'dark' || (pref === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light');
})();
