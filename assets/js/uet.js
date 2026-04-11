/**
 * Shared UET (Microsoft Ads) helper for game pages.
 * Loads bat.js once, respects stored consent, and exposes a tiny event API.
 *
 * Usage in game pages:
 *   <script src="../../../assets/js/uet.js"></script>
 *   Then call:  window.uetEvent('game_start', { game: 'frost-signal' });
 *               window.uetEvent('game_end',   { game: 'frost-signal', result: 'win' });
 */
(function () {
  'use strict';

  const TAG_ID = '355052824';

  // 1. Initialize queue and consent default (denied until user opts in)
  window.uetq = window.uetq || [];
  window.uetq.push('consent', 'default', { ad_storage: 'denied' });

  // 2. Restore saved consent from homepage banner
  let saved = null;
  try { saved = localStorage.getItem('consent.uet.ad_storage'); } catch (_) {}
  if (saved === 'granted' || saved === 'denied') {
    window.uetq.push('consent', 'update', { ad_storage: saved });
  }

  // 3. Load bat.js
  (function (w, d, t, r, u) {
    w[u] = w[u] || [];
    const f = function () {
      const o = { ti: TAG_ID, enableAutoSpaTracking: true };
      o.q = w[u];
      w[u] = new UET(o);
      w[u].push('pageLoad');
    };
    const n = d.createElement(t);
    n.src = r;
    n.async = 1;
    n.onload = n.onreadystatechange = function () {
      const s = this.readyState;
      if (s && s !== 'loaded' && s !== 'complete') return;
      f();
      n.onload = n.onreadystatechange = null;
    };
    const i = d.getElementsByTagName(t)[0];
    i.parentNode.insertBefore(n, i);
  })(window, document, 'script', '//bat.bing.com/bat.js', 'uetq');

  // 4. Custom event helper
  //    See: https://help.ads.microsoft.com/#apex/ads/en/56681/2
  window.uetEvent = function (action, params) {
    window.uetq = window.uetq || [];
    const evt = { ea: action, ec: 'game' };
    if (params && typeof params === 'object') {
      const labels = [];
      if (params.game) labels.push(String(params.game));
      if (params.result) labels.push(String(params.result));
      if (labels.length) evt.el = labels.join(':');

      if (Number.isFinite(params.ev)) evt.ev = Number(params.ev);
      else if (Number.isFinite(params.value)) evt.ev = Number(params.value);

      if (Number.isFinite(params.revenue)) evt.gv = Number(params.revenue);
    }
    window.uetq.push(evt);
  };
})();
