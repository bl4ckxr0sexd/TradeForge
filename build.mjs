// TradeForge landing page build.
// Converts design/TradeForge-Landing.dc.html (Claude Design export) into a
// standalone index.html plus robots.txt / sitemap.xml, applying config from .env.
//
// Usage: node build.mjs   (re-run after editing .env or src/enhance.*)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ---------- config ----------
const DEFAULTS = {
  SITE_URL: 'https://tradeforge.app',
  DOWNLOAD_URL: 'https://downloads.tradeforge.app/TradeForge-Setup.exe',
  GOOGLE_SITE_VERIFICATION: '',
  BING_SITE_VERIFICATION: '',
  GOOGLE_ADS_ID: '',
  GOOGLE_ADS_CONVERSION_LABEL: '',
  GA4_ID: '',
  MICROSOFT_UET_ID: '',
};

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const envOverrides = Object.fromEntries(
  Object.keys(DEFAULTS)
    .filter((k) => process.env[k] !== undefined)
    .map((k) => [k, process.env[k]])
);
const env = {
  ...DEFAULTS,
  ...loadEnv(fileURLToPath(new URL('.env', import.meta.url))),
  ...envOverrides,
};
const SITE = env.SITE_URL.replace(/\/$/, '');

const TITLE = 'TradeForge — Automated Solana Trading Bots for Windows';
const DESCRIPTION =
  'TradeForge runs automated Solana trading bots locally on your Windows PC — snipe new pairs, run grid & DCA strategies with Jupiter routing, and keep your wallet self-custodied with locally encrypted keys. Download the free desktop client.';

// ---------- read design export ----------
const content = readFileSync(new URL('design/TradeForge-Landing.dc.html', import.meta.url), 'utf8');

const dcOpen = content.indexOf('<x-dc>');
const dcClose = content.lastIndexOf('</x-dc>');
if (dcOpen === -1 || dcClose === -1) throw new Error('no <x-dc> block found');
let template = content.slice(dcOpen + '<x-dc>'.length, dcClose);

const helmetMatch = /<helmet>([\s\S]*?)<\/helmet>/.exec(template);
const helmet = helmetMatch ? helmetMatch[1].trim() : '';
template = template.replace(/<helmet>[\s\S]*?<\/helmet>/, '').trim();

// ---------- transforms ----------

// 1. style-hover="..." → generated :hover classes (base styles are inline, so
//    hover declarations need !important to win).
const hoverRules = [];
let hoverCount = 0;
template = template.replace(/style-hover="([^"]*)"/g, (_, css) => {
  hoverCount += 1;
  const cls = `hv-${hoverCount}`;
  const important = css
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => `${d} !important`)
    .join('; ');
  hoverRules.push(`  .${cls}:hover { ${important}; }`);
  return `class="${cls}"`;
});
if (/class="[^"]*"[^>]*class="/.test(template)) {
  throw new Error('element with duplicate class attributes — needs merging');
}

// 2. `download` on a fragment anchor makes the browser download the page
//    itself instead of scrolling — strip it everywhere first.
template = template.replace(/(<a href="#download") download/g, '$1');

// 3. Wire the real installer URL (from .env) into the buttons inside the
//    pricing and final-CTA sections. Nav/hero/footer buttons keep scrolling
//    to #download so visitors see the CTA context first.
function rewriteSection(id, fn) {
  const start = template.indexOf(`id="${id}"`);
  if (start === -1) throw new Error(`section #${id} not found`);
  const end = template.indexOf('<!-- =====', start);
  const before = template.slice(0, start);
  const section = template.slice(start, end === -1 ? undefined : end);
  const after = end === -1 ? '' : template.slice(end);
  template = before + fn(section) + after;
}
for (const id of ['pricing', 'download']) {
  rewriteSection(id, (s) =>
    s.replace(/href="#download"/g, `href="${env.DOWNLOAD_URL}" download`)
  );
}

// 4. Footer legal links: point at real pages instead of dead "#".
template = template
  .replace(/href="#"([^>]*>Terms of Service<)/, 'href="terms.html"$1')
  .replace(/href="#"([^>]*>Privacy Policy<)/, 'href="privacy.html"$1')
  .replace(/href="#"([^>]*>Cookie Policy<)/, 'href="privacy.html#cookies"$1')
  .replace(/href="#"([^>]*>Risk Disclosure<)/, 'href="#compliance"$1')
  .replace(/href="#"([^>]*>Contact & Support<)/, 'href="mailto:support@tradeforge.app"$1');

// 5. Nav CTA reads just "Download" on small screens (first match is the nav).
template = template.replace(
  /(<nav[\s\S]*?)Download for Windows/,
  '$1Download<span class="cta-long"> for Windows</span>'
);

// 6. Responsive layer: tag fixed multi-column grids so media queries can
//    collapse them. 2–3 tracks → g1 (1 col on tablet), 4 tracks → g2
//    (2 cols on tablet, 1 on phones). The 5-track positions table stays.
const addClass = (tagStr, cls) =>
  /class="/.test(tagStr)
    ? tagStr.replace(/class="([^"]*)"/, `class="$1 ${cls}"`)
    : tagStr.replace(/^<([a-z]+)/, `<$1 class="${cls}"`);

template = template.replace(/<[a-z]+ [^>]*>/g, (tagStr) => {
  const style = /style="([^"]*)"/.exec(tagStr);
  if (!style) return tagStr;
  const gtc = /grid-template-columns:\s*([^;"]+)/.exec(style[1]);
  if (!gtc) return tagStr;
  const expanded = gtc[1]
    .trim()
    .replace(/repeat\((\d+),\s*([^)]+)\)/g, (_, n, t) => Array(Number(n)).fill(t.trim()).join(' '));
  const tracks = expanded.split(/\s+/).length;
  if (tracks === 2 || tracks === 3) return addClass(tagStr, 'g1');
  if (tracks === 4) return addClass(tagStr, 'g2');
  return tagStr;
});

// 6. Tag the nav link row so it can be hidden on small screens.
template = template.replace(
  /<div style="display: flex; align-items: center; gap: 30px; font-size: 15px;/,
  '<div class="nav-links" style="display: flex; align-items: center; gap: 30px; font-size: 15px;'
);

// 7. All inline SVGs are decorative — hide them from assistive tech.
template = template.replace(/<svg (?![^>]*aria-)/g, '<svg aria-hidden="true" focusable="false" ');

// ---------- head blocks ----------
const responsiveCss = `
  @media (max-width: 960px) {
    .nav-links { display: none !important; }
    .g1 { grid-template-columns: 1fr !important; }
    .g2 { grid-template-columns: repeat(2, 1fr) !important; }
    header h1 { font-size: 42px !important; }
    section h2 { font-size: 31px !important; }
  }
  @media (max-width: 560px) {
    .g2 { grid-template-columns: 1fr !important; }
    header h1 { font-size: 34px !important; }
  }`;

const enhanceCss = readFileSync(new URL('src/enhance.css', import.meta.url), 'utf8');
const enhanceJs = readFileSync(new URL('src/enhance.js', import.meta.url), 'utf8');

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%2322F0A9'/%3E%3Cpath d='M5 15l4.5-4.5 3 3L19 7' stroke='%2305210F' stroke-width='2.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'TradeForge',
      operatingSystem: 'Windows 10, Windows 11',
      applicationCategory: 'FinanceApplication',
      description: DESCRIPTION,
      url: `${SITE}/`,
      downloadUrl: env.DOWNLOAD_URL,
      image: `${SITE}/og-image.png`,
      offers: [
        { '@type': 'Offer', name: 'Free Trial', price: '0', priceCurrency: 'USD' },
        { '@type': 'Offer', name: 'Pro Plan', price: '39', priceCurrency: 'USD' },
      ],
      publisher: { '@type': 'Organization', name: 'TradeForge Technologies Ltd.', url: `${SITE}/` },
    },
    {
      '@type': 'WebSite',
      name: 'TradeForge',
      url: `${SITE}/`,
    },
  ],
};

const verification = [
  env.GOOGLE_SITE_VERIFICATION &&
    `<meta name="google-site-verification" content="${env.GOOGLE_SITE_VERIFICATION}">`,
  env.BING_SITE_VERIFICATION &&
    `<meta name="msvalidate.01" content="${env.BING_SITE_VERIFICATION}">`,
]
  .filter(Boolean)
  .join('\n');

// Tracking: Consent Mode v2 defaults to denied; the consent banner
// (src/tracking.js) upgrades to granted when the visitor accepts.
const hasGtag = Boolean(env.GOOGLE_ADS_ID || env.GA4_ID);
const hasTracking = hasGtag || Boolean(env.MICROSOFT_UET_ID);
const adsConversion =
  env.GOOGLE_ADS_ID && env.GOOGLE_ADS_CONVERSION_LABEL
    ? `${env.GOOGLE_ADS_ID}/${env.GOOGLE_ADS_CONVERSION_LABEL}`
    : '';

const adsTags = [
  hasGtag &&
    `<!-- Google tag (gtag.js) with Consent Mode v2 -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });
  gtag('js', new Date());
${[env.GOOGLE_ADS_ID, env.GA4_ID].filter(Boolean).map((id) => `  gtag('config', '${id}');`).join('\n')}
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=${env.GOOGLE_ADS_ID || env.GA4_ID}"></script>`,
  env.MICROSOFT_UET_ID &&
    `<!-- Microsoft Advertising UET (consent defaults to denied) -->
<script>
  window.uetq = window.uetq || [];
  window.uetq.push('consent', 'default', { ad_storage: 'denied' });
  (function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[],f=function(){var o={ti:"${env.MICROSOFT_UET_ID}", enableAutoSpaTracking: true};o.q=w[u],w[u]=new UET(o),w[u].push("pageLoad")},n=d.createElement(t),n.src=r,n.async=1,n.onload=n.onreadystatechange=function(){var s=this.readyState;s&&s!=="loaded"&&s!=="complete"||(f(),n.onload=n.onreadystatechange=null)},i=d.getElementsByTagName(t)[0],i.parentNode.insertBefore(n,i)})(window,document,"script","//bat.bing.com/bat.js","uetq");
</script>`,
]
  .filter(Boolean)
  .join('\n');

const trackingJs = hasTracking
  ? `<script>window.__TF_TRACKING__ = ${JSON.stringify({ adsConversion: adsConversion || null })};</script>
<script>
${readFileSync(new URL('src/tracking.js', import.meta.url), 'utf8')}
</script>`
  : '';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${SITE}/">
<meta name="theme-color" content="#070A14">
<link rel="icon" href="${FAVICON}">
${verification}
<meta property="og:type" content="website">
<meta property="og:site_name" content="TradeForge">
<meta property="og:url" content="${SITE}/">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${TITLE}">
<meta name="twitter:description" content="${DESCRIPTION}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
${adsTags}
${helmet}
<style>
${hoverRules.join('\n')}
${responsiveCss}
${enhanceCss}
</style>
</head>
<body>
${template}
<script>
${enhanceJs}
</script>
${trackingJs}
</body>
</html>
`;

writeFileSync(new URL('index.html', import.meta.url), html);

// ---------- robots.txt & sitemap.xml ----------
writeFileSync(
  new URL('robots.txt', import.meta.url),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`
);

const today = new Date().toISOString().slice(0, 10);
const urls = ['/', '/privacy.html', '/terms.html']
  .map(
    (p) => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod></url>`
  )
  .join('\n');
writeFileSync(
  new URL('sitemap.xml', import.meta.url),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
);

console.log(
  `built index.html (${html.length} bytes, ${hoverCount} hover rules), robots.txt, sitemap.xml`
);
console.log(`download URL: ${env.DOWNLOAD_URL}`);
console.log(`site URL:     ${SITE}`);
console.log(
  `google ads:   ${env.GOOGLE_ADS_ID || '(not set)'} · conversion label: ${env.GOOGLE_ADS_CONVERSION_LABEL || '(not set)'} · ga4: ${env.GA4_ID || '(not set)'} · microsoft uet: ${env.MICROSOFT_UET_ID || '(not set)'}`
);
console.log(`tracking layer: ${hasTracking ? 'injected (consent banner + conversion events)' : 'omitted (no tracking IDs set)'}`);
