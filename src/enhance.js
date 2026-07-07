(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- nav: elevation on scroll ----
  const nav = document.querySelector('nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- nav: mobile menu ----
  const links = document.querySelector('.nav-links');
  if (links) {
    const row = nav.firstElementChild;
    const btn = document.createElement('button');
    btn.className = 'nav-burger';
    btn.setAttribute('aria-label', 'Open menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    row.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'nav-panel';
    links.querySelectorAll('a').forEach((a) => panel.appendChild(a.cloneNode(true)));
    nav.appendChild(panel);

    btn.addEventListener('click', () => {
      const open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
    panel.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        panel.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (reduced) return; // everything below is decorative motion

  // ---- shared "element became visible" observer ----
  const seenCbs = new WeakMap();
  const seenIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      seenIO.unobserve(en.target);
      (seenCbs.get(en.target) || []).forEach((fn) => fn());
    });
  }, { threshold: 0.2 });
  const onSeen = (el, fn) => {
    const arr = seenCbs.get(el) || [];
    arr.push(fn);
    seenCbs.set(el, arr);
    seenIO.observe(el);
  };

  // ---- scroll-reveal with per-parent stagger ----
  const targets = new Set();
  document.querySelectorAll('#top .g1 > div:first-child > *').forEach((el) => targets.add(el));
  const mock = document.querySelector('#top .g1 > div:last-child');
  if (mock) targets.add(mock);
  document.querySelectorAll('section h2, footer h2').forEach((h) => targets.add(h.parentElement));
  const terminalBox = document.querySelector('#terminal > div');
  if (terminalBox) targets.add(terminalBox);
  document.querySelectorAll('.g1 > *, .g2 > *').forEach((el) => {
    if (el.closest('nav') || el.closest('#top')) return;
    if (terminalBox && terminalBox.contains(el)) return; // parent box reveals as one
    targets.add(el);
  });

  const counts = new Map();
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      revealIO.unobserve(en.target);
      en.target.classList.add('in');
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

  targets.forEach((el) => {
    const n = counts.get(el.parentElement) || 0;
    counts.set(el.parentElement, n + 1);
    el.classList.add('rv');
    el.style.transitionDelay = `${Math.min(n * 70, 420)}ms`;
    revealIO.observe(el);
  });

  // ---- animated counters (big standalone numbers only) ----
  const numRe = /^([$+-]?)([\d,]+(?:\.\d+)?)(K\+|%|\+)?$/;
  const fmt = (v, dec, grouped) => {
    const s = v.toFixed(dec);
    if (!grouped) return s;
    const [i, f] = s.split('.');
    return Number(i).toLocaleString('en-US') + (f ? '.' + f : '');
  };
  document.querySelectorAll('div, span').forEach((el) => {
    if (el.children.length) return;
    const m = numRe.exec(el.textContent.trim());
    if (!m) return;
    if (parseFloat(getComputedStyle(el).fontSize) < 20) return;
    const [, pre, num, suf = ''] = m;
    const target = parseFloat(num.replace(/,/g, ''));
    const dec = (num.split('.')[1] || '').length;
    const grouped = num.includes(',');
    onSeen(el, () => {
      const t0 = performance.now();
      const DUR = 1300;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / DUR);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = pre + fmt(target * ease, dec, grouped) + suf;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });

  // ---- bar charts grow in (scaleY keeps it on the compositor) ----
  const bars = document.querySelectorAll('div[style*="4px 4px 0 0"], div[style*="3px 3px 0 0"]');
  const barParents = new Set();
  bars.forEach((bar) => {
    bar.style.transformOrigin = 'bottom';
    bar.style.transform = 'scaleY(0.04)';
    barParents.add(bar.parentElement);
  });
  barParents.forEach((parent) => {
    onSeen(parent, () => {
      [...parent.children].forEach((bar, i) => {
        bar.style.transition = `transform .8s cubic-bezier(.16,1,.3,1) ${i * 50}ms`;
        bar.style.transform = '';
      });
    });
  });

  // ---- candlestick chart: line draws, candles fade in ----
  const chartSvg = document.querySelector('#terminal svg[viewBox="0 0 640 300"]');
  if (chartSvg) {
    const line = chartSvg.querySelector('path[fill="none"]');
    const area = chartSvg.querySelector('path[fill^="url"]');
    const groups = chartSvg.querySelectorAll('g');
    if (line) {
      const len = line.getTotalLength();
      line.style.strokeDasharray = String(len);
      line.style.strokeDashoffset = String(len);
    }
    if (area) area.style.opacity = '0';
    groups.forEach((g) => (g.style.opacity = '0'));
    onSeen(chartSvg, () => {
      if (line) {
        line.style.transition = 'stroke-dashoffset 1.6s ease-out';
        line.style.strokeDashoffset = '0';
      }
      if (area) {
        area.style.transition = 'opacity 1s ease-out .5s';
        area.style.opacity = '1';
      }
      groups.forEach((g, i) => {
        g.style.transition = `opacity .6s ease-out ${400 + i * 180}ms`;
        g.style.opacity = '1';
      });
    });
  }

  // ---- allocation donut: segments sweep in ----
  const donut = document.querySelector('svg[viewBox="0 0 42 42"]');
  if (donut) {
    const segs = [...donut.querySelectorAll('circle[stroke-dasharray]')];
    segs.forEach((c) => {
      c.dataset.dash = c.getAttribute('stroke-dasharray');
      c.style.strokeDasharray = '0 100';
    });
    onSeen(donut, () => {
      segs.forEach((c, i) => {
        c.style.transition = `stroke-dasharray 1s cubic-bezier(.16,1,.3,1) ${i * 140}ms`;
        c.style.strokeDasharray = c.dataset.dash;
      });
    });
  }
})();
