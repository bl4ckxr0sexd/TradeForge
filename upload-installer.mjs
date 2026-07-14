// Upload the TradeForge installer to Vercel Blob under its REAL filename.
// The public file name matches the build exactly (download/<original name>),
// so whatever the installer is called is what visitors download. Because the
// name changes per release, the URL changes too — after each run, put the
// printed URL into DOWNLOAD_URL in .env and rebuild (node build.mjs).
//
// Usage:
//   $env:BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_..."   (PowerShell)
//   node upload-installer.mjs "C:\path\to\TradeForge_Setup (...).msi"
import { put } from '@vercel/blob';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('usage: node upload-installer.mjs <path-to.msi>');
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('set BLOB_READ_WRITE_TOKEN in your environment first');
  process.exit(1);
}

const blob = await put(`download/${basename(file)}`, readFileSync(file), {
  access: 'public',
  addRandomSuffix: false, // exact name, no random suffix
  allowOverwrite: true,   // replace if the same name is re-uploaded
  contentType: 'application/x-msi',
});

console.log(blob.url);
