#!/usr/bin/env node
/**
 * Simple verification script to list missing expected font files.
 */
import fs from 'node:fs';
import path from 'node:path';

const expected = {
  inter: ['Inter-400.woff2','Inter-500.woff2','Inter-600.woff2','Inter-700.woff2','Inter-800.woff2'],
  'general-sans': ['GeneralSans-500.woff2','GeneralSans-600.woff2','GeneralSans-700.woff2']
};

const base = path.join(process.cwd(),'public/fonts');
let interMissing = [];
let generalSansMissing = [];

for(const dir of Object.keys(expected)) {
  const full = path.join(base, dir);
  const present = new Set(fs.existsSync(full) ? fs.readdirSync(full) : []);
  const miss = expected[dir].filter(f=>!present.has(f));
  if(miss.length) {
    if(dir === 'inter') interMissing = miss; else generalSansMissing = miss;
    console.log(`[MISSING] ${dir}: ${miss.join(', ')}`);
  } else {
    console.log(`[OK] ${dir}: all expected files present`);
  }
}

if(interMissing.length) {
  console.log(`\nERROR: Missing required Inter font file(s): ${interMissing.join(', ')}`);
  process.exitCode = 1;
} else if(generalSansMissing.length) {
  console.log(`\nWARN: General Sans optional files missing: ${generalSansMissing.join(', ')} (no build fail).`);
  console.log('Add them under public/fonts/general-sans/ to enable that family.');
} else {
  console.log('\nAll required (Inter) and optional (General Sans) font files present.');
}
