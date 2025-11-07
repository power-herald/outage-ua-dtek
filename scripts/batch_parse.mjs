#!/usr/bin/env node
// Batch-parse outputs/*.html into data/<region>.json using the single-file parser (parse_fact.js)
// Usage:
//   REGION_SOURCES_JSON='{"kyiv":"https://..."}' node scripts/batch_parse.mjs   # parse all outputs/*.html
//   REGION=kyiv node scripts/batch_parse.mjs                                        # parse only one region
// Notes:
// - Does not fail the process on partial errors; prints a summary and exits 0.
// - Reads upstream mapping from REGION_SOURCES_JSON env (JSON object), without jq.

import { readdir, mkdir, stat } from 'node:fs/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const projectRoot = process.cwd();
const outputsDir = path.join(projectRoot, 'outputs');
const dataDir = path.join(projectRoot, 'data');
const parserScript = path.join(projectRoot, 'scripts', 'parse_fact.js');

function parseEnvJson(name, def = {}) {
  const raw = process.env[name];
  if (!raw) return def;
  try { return JSON.parse(raw); } catch { return def; }
}

const REGION = process.env.REGION || '';
const sources = parseEnvJson('REGION_SOURCES_JSON', {});

async function fileExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function listOutputsHtml() {
  try {
    const entries = await readdir(outputsDir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.html'))
      .map(e => path.join(outputsDir, e.name));
  } catch (_) {
    return [];
  }
}

function deriveRegionFromFile(filePath) {
  const stem = path.basename(filePath, '.html');
  return stem;
}

function runParser({ region, htmlPath, upstream, outPath }) {
  return new Promise((resolve) => {
    const args = [parserScript, '--region', region, '--in', htmlPath, '--out', outPath];
    if (upstream) { args.push('--upstream', upstream); }
    args.push('--pretty');
    const child = spawn(process.execPath, args, { stdio: 'inherit' });
    child.on('exit', (code) => resolve({ code: code ?? 0 }));
  });
}

(async () => {
  if (!(await fileExists(parserScript))) {
    console.error(`[ERROR] Parser script not found: ${parserScript}`);
    process.exit(1);
  }
  await mkdir(dataDir, { recursive: true });

  const files = (await listOutputsHtml()).filter(f => {
    if (!REGION) return true;
    const reg = deriveRegionFromFile(f);
    return reg === REGION;
  });

  if (files.length === 0) {
    console.warn('[WARN] No HTML files to parse in outputs/. Nothing to do.');
    process.exit(0);
  }

  let processed = 0, success = 0, failed = 0;
  for (const htmlPath of files) {
    const region = deriveRegionFromFile(htmlPath);
    const outPath = path.join(dataDir, `${region}.json`);
    const upstream = typeof sources[region] === 'string' ? sources[region] : '';

    processed++;
    console.log(`[INFO] Parsing region='${region}' from ${path.relative(projectRoot, htmlPath)} → ${path.relative(projectRoot, outPath)}`);
    const { code } = await runParser({ region, htmlPath, upstream, outPath });
    if (code === 0) success++; else failed++;
  }

  console.log(`[INFO] Done. Processed: ${processed}, successful: ${success}, failed: ${failed}`);
  // Always exit 0 to not break pipelines due to partial failures
  process.exit(0);
})();
