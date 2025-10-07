#!/usr/bin/env node
/**
 * Deterministic font provisioner using @fontsource/inter.
 * Copies required Inter weights (400,500,600,700,800) into public/fonts/inter
 * with canonical filenames Inter-<weight>.woff2 expected by fonts.css.
 * Falls back to warning if a weight file is unexpectedly missing.
 * Leaves General Sans placeholder untouched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const INTER_WEIGHTS = [400,500,600,700,800];
const PKG_ROOT = path.dirname(require.resolve('@fontsource/inter/package.json'));
const FILE_DIR = path.join(PKG_ROOT, 'files');
const OUT_DIR_INTER = path.join(process.cwd(), 'public/fonts/inter');
const OUT_DIR_GS = path.join(process.cwd(), 'public/fonts/general-sans');

async function ensureDir(p){ await fs.promises.mkdir(p,{recursive:true}); }

async function copyInter(){
  await ensureDir(OUT_DIR_INTER);
  const summary = [];
  for (const w of INTER_WEIGHTS) {
    const pattern = new RegExp(`^inter-.*-${w}-normal\\.woff2$`);
    const candidates = fs.readdirSync(FILE_DIR).filter(f=>pattern.test(f));
    if(!candidates.length){
      summary.push({ weight: w, action: 'missing-src' });
      console.warn('Missing fontsource file for weight', w);
      continue;
    }
    const src = path.join(FILE_DIR, candidates[0]);
    const dest = path.join(OUT_DIR_INTER, `Inter-${w}.woff2`);
    if (fs.existsSync(dest)) {
      summary.push({ weight: w, action: 'skip-existing' });
      continue;
    }
    fs.copyFileSync(src,dest);
    const bytes = fs.statSync(dest).size;
    summary.push({ weight: w, action: 'copied', bytes });
  }
  console.table(summary);
  const missing = INTER_WEIGHTS.filter(w=>!fs.existsSync(path.join(OUT_DIR_INTER, `Inter-${w}.woff2`)));
  if(missing.length){
    console.error('ERROR: Missing Inter weights after copy:', missing.join(','));
    process.exit(2);
  }
  console.log('Inter copy complete. All required weights present.');
}

async function ensureGeneralSans(){
  await ensureDir(OUT_DIR_GS);
  const placeholder = path.join(OUT_DIR_GS,'README.txt');
  if(!fs.existsSync(placeholder)){
    await fs.promises.writeFile(
      placeholder,
      'General Sans is not auto-fetched. Add files GeneralSans-500.woff2, GeneralSans-600.woff2, GeneralSans-700.woff2 manually (ensure proper licensing).\n'
    );
  }
}

async function main(){
  await copyInter();
  await ensureGeneralSans();
}

main().catch(e=>{ console.error(e); process.exit(1); });
