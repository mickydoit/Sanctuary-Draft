// Light client-side enhancements. The app works fully without JS.

// On the live pages (ladder / fixtures), refresh periodically so entered
// scores show up without a manual reload.
(function autoRefresh() {
  const path = window.location.pathname;
  if (path === '/' || path === '/fixtures') {
    setTimeout(() => window.location.reload(), 60000);
  }
})();
