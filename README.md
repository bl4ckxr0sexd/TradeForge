# TradeForge Landing Page

Static marketing site for the TradeForge Windows desktop client, generated from a
Claude Design export (`design/TradeForge-Landing.dc.html`).

## Structure

```
├── .env                  # site config — download link, ad tags (edit this)
├── build.mjs             # build script: design export + .env → site files
├── design/               # design source of truth (Claude Design export)
├── src/
│   ├── enhance.css       # animation / nav / a11y styles
│   └── enhance.js        # scroll reveal, counters, chart animations, mobile menu
├── index.html            # generated — do not edit by hand
├── robots.txt            # generated
├── sitemap.xml           # generated
├── privacy.html          # legal template — have counsel review
├── terms.html            # legal template — have counsel review
└── og-image.png          # social share image (1200×630)
```

## Updating the download link

Edit `DOWNLOAD_URL` in `.env`, then rebuild:

```bash
node build.mjs
```

Every download button in the pricing and final-CTA sections picks up the new
link. Nav/hero buttons intentionally scroll to the download section.

## Going live with ads

1. Set `SITE_URL` in `.env` to the real deployed domain, rebuild, and redeploy —
   this fixes the canonical URL, sitemap, and Open Graph tags.
2. Add `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` tokens from
   Search Console and Bing Webmaster Tools, rebuild, verify, then submit
   `sitemap.xml` in both consoles.
3. Set `GOOGLE_ADS_ID` (AW-…), `GOOGLE_ADS_CONVERSION_LABEL`, optionally
   `GA4_ID`, and/or `MICROSOFT_UET_ID`, then rebuild. The build injects:
   - the Google tag and/or Microsoft UET tag,
   - **Consent Mode v2** (all storage denied by default) plus a GDPR consent
     banner — tags only collect ad data after the visitor accepts,
   - **conversion events** on installer download clicks: a Google Ads
     `conversion` event (using your conversion label), a `file_download`
     event for GA4, and a UET `download` event for Microsoft.
   Create the matching conversion action in Google Ads (get the label from
   its tag setup screen) and a custom `download` event goal in Microsoft
   Advertising.
4. Have counsel finalize `privacy.html` and `terms.html` — both are required
   for ad approval.
5. Note: crypto/financial products are a restricted ads category on both
   Google and Microsoft — expect a certification step for the ad account.
