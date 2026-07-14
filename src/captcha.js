// reCAPTCHA v2 download gate. No-op if the modal markup isn't on the page
// (i.e. RECAPTCHA_SITE_KEY isn't set in .env — build.mjs then leaves the
// old direct-download buttons in place instead of injecting this).
(function () {
  var modal = document.getElementById('tf-captcha-modal');
  if (!modal) return;

  var confirmBtn = document.getElementById('tf-modal-confirm');
  var errorEl = document.getElementById('tf-modal-error');
  var confirmLabel = confirmBtn.textContent;

  window.tfCaptchaSolved = function () {
    confirmBtn.disabled = false;
    errorEl.hidden = true;
  };
  window.tfCaptchaExpired = function () {
    confirmBtn.disabled = true;
  };

  function openModal(e) {
    e.preventDefault();
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    confirmBtn.disabled = true;
    errorEl.hidden = true;
    if (window.grecaptcha) {
      try { grecaptcha.reset(); } catch (err) { /* not rendered yet */ }
    }
  }

  document.querySelectorAll('a[href="#download-captcha"]').forEach(function (a) {
    a.addEventListener('click', openModal);
  });
  modal.querySelectorAll('[data-tf-close]').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  confirmBtn.addEventListener('click', function () {
    var token = window.grecaptcha ? grecaptcha.getResponse() : '';
    if (!token) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Verifying…';
    fetch('/api/verify-captcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (result.ok && result.data && result.data.url) {
          window.location.href = result.data.url;
          closeModal();
        } else {
          errorEl.hidden = false;
          if (window.grecaptcha) grecaptcha.reset();
          confirmBtn.disabled = false;
        }
      })
      .catch(function () {
        errorEl.hidden = false;
        confirmBtn.disabled = false;
      })
      .finally(function () {
        confirmBtn.textContent = confirmLabel;
      });
  });
})();
