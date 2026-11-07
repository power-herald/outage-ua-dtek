const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('extracts stabilizing notices independently and includes them in the hash', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'outage-parse-test-'));
  const input = path.join(directory, 'input.html');
  const output = path.join(directory, 'output.json');
  const script = path.join(__dirname, '..', 'scripts', 'parse_fact.js');
  const parse = (notice) => {
    fs.writeFileSync(input, `<script>DisconSchedule.fact = {}</script>${notice}`);
    execFileSync(process.execPath, [script, '--region', 'test', '--in', input, '--out', output]);
    const result = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(result.lastUpdateStatus.ok, true);
    return result;
  };

  try {
    const inactive = parse('<p>стабілізаційні</p>');
    const active = parse('<div class="other m-attention__text"><p><span>СТАБІЛІЗАЦІЙНІ</span></p></div>');
    assert.equal(inactive.stabilizing.enabled, false);
    assert.equal(active.stabilizing.enabled, true);
    assert.equal(active.emergency.enabled, false);
    assert.notEqual(active.meta.contentHash, inactive.meta.contentHash);

    const emergency = parse('<div class="m-attention__text"><p><strong>екстрені</strong></p></div>');
    assert.equal(emergency.stabilizing.enabled, false);
    assert.equal(emergency.emergency.enabled, true);

    const existingBehavior = parse('<div class="m-attention__text"><p><strong>стабілізаційні</strong></p></div>');
    assert.equal(existingBehavior.stabilizing.enabled, true);
    assert.equal(existingBehavior.emergency.enabled, true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('extracts district emergency text without changing general emergency detection', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'outage-parse-test-'));
  const input = path.join(directory, 'input.html');
  const output = path.join(directory, 'output.json');
  const script = path.join(__dirname, '..', 'scripts', 'parse_fact.js');
  const parse = (notice) => {
    fs.writeFileSync(input, `<script>DisconSchedule.fact = {}</script>${notice}`);
    execFileSync(process.execPath, [script, '--region', 'test', '--in', input, '--out', output]);
    const result = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(result.lastUpdateStatus.ok, true);
    return result;
  };

  try {
    const general = parse('<div class="m-attention__text"><p><strong>екстрені</strong></p></div>');
    assert.deepEqual(general.emergency, { enabled: true, enabled_districts: null });

    const outside = parse('<div><strong>аварійне відключення</strong> в районі.</div>');
    assert.deepEqual(outside.emergency, { enabled: false, enabled_districts: null });

    const district = parse('<div class="m-attention__text"><p><span><strong>аварійне відключення</strong> в частині Деснянського&nbsp;району.</span></p></div>');
    assert.deepEqual(district.emergency, { enabled: false, enabled_districts: ' в частині Деснянського&nbsp;району.' });

    const changed = parse('<div class="m-attention__text"><p><strong>аварійне відключення</strong> в іншому районі.</p></div>');
    assert.notEqual(changed.meta.contentHash, district.meta.contentHash);

    const both = parse('<div class="m-attention__text"><p><strong>екстрені</strong> <strong>аварійне відключення</strong> в районі.</p></div>');
    assert.deepEqual(both.emergency, { enabled: true, enabled_districts: ' в районі.' });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});