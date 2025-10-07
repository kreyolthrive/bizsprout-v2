#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const publicFontsDir = path.join(root, 'public', 'fonts');
const hashFile = path.join(__dirname, 'font-hashes.json');

async function walk(dir, acc = []) {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, acc);
    else if (/\.(woff2?|ttf|otf)$/i.test(e.name)) acc.push(full);
  }
  return acc;
}

async function fileSha256(p) {
  const buf = await fs.readFile(p);
  return createHash('sha256').update(buf).digest('hex');
}

async function loadHashMap() {
  try { return (JSON.parse(await fs.readFile(hashFile, 'utf8')).files) || {}; } catch { return {}; }
}

function relFontPath(abs) {
  return path.relative(publicFontsDir, abs).replace(/\\/g,'/');
}

async function recordMode(currentMap) {
  const json = { _comment: 'Recorded SHA256 hashes for self-hosted font binaries. Auto-generated.', files: currentMap };
  await fs.writeFile(hashFile, JSON.stringify(json, null, 2) + '\n');
  console.log('Updated', hashFile, 'with', Object.keys(currentMap).length, 'font hashes');
}

async function main() {
  const record = process.argv.includes('--record');
  let stat;
  try { stat = await fs.stat(publicFontsDir); } catch {
    console.error('Fonts directory missing:', publicFontsDir); process.exit(2);
  }
  if (!stat.isDirectory()) { console.error('Fonts path is not a directory:', publicFontsDir); process.exit(2); }

  const files = await walk(publicFontsDir);
  const fontFiles = files.filter(f => /\.(woff2?|ttf|otf)$/i.test(f));
  if (!fontFiles.length) { console.error('No font binaries found in', publicFontsDir); process.exit(2); }

  const currentMap = {};
  for (const f of fontFiles) {
    currentMap[relFontPath(f)] = await fileSha256(f);
  }

  if (record) { await recordMode(currentMap); return; }

  const baseline = await loadHashMap();
  if (!Object.keys(baseline).length) { console.warn('No baseline hashes recorded. Run with --record to create baseline.'); process.exit(0); }

  const changed = [];
  const missing = [];
  const extra = [];

  for (const [rel, hash] of Object.entries(currentMap)) {
    if (!baseline[rel]) missing.push(rel);
    else if (baseline[rel] !== hash) changed.push({ file: rel, expected: baseline[rel], actual: hash });
  }
  for (const rel of Object.keys(baseline)) {
    if (!currentMap[rel]) extra.push(rel);
  }

  if (!missing.length && !changed.length && !extra.length) {
    console.log('Font integrity OK (' + fontFiles.length + ' files)');
    process.exit(0);
  }

  if (missing.length) console.error('New font files without baseline:', missing.join(', '));
  if (changed.length) {
    console.error('Changed hashes detected:');
    for (const c of changed) console.error(`  ${c.file}: expected ${c.expected} got ${c.actual}`);
  }
  if (extra.length) console.error('Baseline lists files not present anymore:', extra.join(', '));
  process.exit(1);
}

if (process.env.IFONT_SKIP === '1') { console.log('IFONT_SKIP=1 set - skipping font integrity'); process.exit(0); }

main().catch(e => { console.error('verify-fonts error', e); process.exit(1); });
