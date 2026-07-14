// Upload the TradeForge installer to Vercel Blob at a STABLE public URL.
// The pathname stays fixed across releases, so DOWNLOAD_URL never changes —
// just re-run this with each new build.
//
// Usage:
//   $env:BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_..."   (PowerShell)
//   node upload-installer.mjs "C:\path\to\TradeForge_Setup.msi"
import { put } from '@vercel/blob';
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node upload-installer.mjs <path-to.msi>');
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('set BLOB_READ_WRITE_TOKEN in your environment first');
  process.exit(1);
}

const blob = await put('download/TradeForge-Setup.msi', readFileSync(file), {
  access: 'public',
  addRandomSuffix: false, // keep the URL identical across releases
  allowOverwrite: true,   // replace the previous build at the same path
  contentType: 'application/x-msi',
});

console.log(blob.url);
