// Consent banner + ad conversion tracking.
// Only injected by build.mjs when at least one tracking ID is set in .env.
(() => {
  'use strict';
  const CFG = window.__TF_TRACKING__ || {};
  const KEY = 'tf-consent';
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch (_) { /* storage blocked */ }

  const grantAll = () => {
    if (window.gtag) {
      gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted',
      });
    }
    window.uetq = window.uetq || [];
    window.uetq.push('consent', 'update', { ad_storage: 'granted' });
  };

  if (stored === 'granted') grantAll();

  if (!stored) {
    const bar = document.createElement('div');
    bar.className = 'consent-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.innerHTML =
      '<p>We use cookies to measure ad performance. Details in our <a href="privacy.html#cookies">privacy policy</a>.</p>' +
      '<div class="consent-actions">' +
      '<button type="button" class="consent-decline">Decline</button>' +
      '<button type="button" class="consent-accept">Accept</button>' +
      '</div>';
    document.body.appendChild(bar);
    const choose = (value) => {
      try { localStorage.setItem(KEY, value); } catch (_) { /* storage blocked */ }
      if (value === 'granted') grantAll();
      bar.remove();
    };
    bar.querySelector('.consent-accept').addEventListener('click', () => choose('granted'));
    bar.querySelector('.consent-decline').addEventListener('click', () => choose('denied'));
  }

  // Conversion events: clicks on the real installer download buttons.
  document.querySelectorAll('a[download]').forEach((a) => {
    a.addEventListener('click', () => {
      if (window.gtag) {
        if (CFG.adsConversion) {
          gtag('event', 'conversion', { send_to: CFG.adsConversion });
        }
        gtag('event', 'file_download', {
          link_url: a.href,
          file_name: 'TradeForge-Setup.exe',
        });
      }
      if (window.uetq) {
        window.uetq.push('event', 'download', {
          event_category: 'installer',
          event_label: a.href,
        });
      }
    });
  });
})();
