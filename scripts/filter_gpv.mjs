import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const gpv = (process.env.GPV || '').trim();
const region = process.env.REGION || '';
if (!gpv || !region) process.exit(0);
if (!/^GPV\d+\.\d+$/i.test(gpv)) {
  console.error('[ERROR] GPV must be a group identifier such as GPV1.2.');
  process.exit(1);
}

function filterGroups(value) {
  if (!value || typeof value !== 'object') return false;
  let changed = false;
  for (const key of Object.keys(value)) {
    if (/^GPV\d+\.\d+$/i.test(key) && key.toLowerCase() !== gpv.toLowerCase()) {
      delete value[key];
      changed = true;
    } else if (filterGroups(value[key])) {
      changed = true;
    }
  }
  return changed;
}

const dataDir = process.argv[2] || 'data';
for (const entry of await readdir(dataDir, { withFileTypes: true })) {
  if (!entry.isFile() || entry.name !== `${region}.json`) continue;
  const file = path.join(dataDir, entry.name);
  const data = JSON.parse(await readFile(file, 'utf8'));
  const factChanged = filterGroups(data.fact);
  const presetChanged = filterGroups(data.preset);
  if (!factChanged && !presetChanged) continue;
  if (data.meta && typeof data.meta === 'object') {
    data.meta.contentHash = createHash('sha256')
      .update(JSON.stringify([data.fact, data.preset, data.emergency, data.stabilizing]))
      .digest('hex');
  }
  await writeFile(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`[INFO] Filtered ${file} to ${gpv}`);
}