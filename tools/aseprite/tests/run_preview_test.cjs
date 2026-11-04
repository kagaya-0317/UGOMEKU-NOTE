// Launch a separate hidden Aseprite UI process; never touch the user's process.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const moduleSource = fs.readFileSync(path.join(root, 'yurayura.lua'), 'utf8');
const testSource = fs.readFileSync(path.join(__dirname, 'yurayura_preview_test.lua'), 'utf8');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yurayura-ui-test-'));
const script = path.join(directory, 'preview-test.lua');
// Bundle the test to avoid Aseprite file-access prompts in the hidden process.
fs.writeFileSync(script,
  `_G.YurayuraPreviewTestModule = (function(...)\n${moduleSource}\nend)("module")\n${testSource}`,
  'utf8');
const executable = process.argv[2] ||
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Aseprite\\Aseprite.exe';
const result = spawnSync(executable, ['--script', script], {
  windowsHide: true,
  encoding: 'utf8',
  timeout: 15000,
});
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.error) process.stderr.write(`${result.error.message}\n`);
const passed = result.status === 0 &&
  (result.stdout || '').includes('All 4 native preview integration checks passed.');
// Keep the bundle on failure to make a native UI error reproducible.
if (passed) {
  fs.unlinkSync(script);
  fs.rmdirSync(directory);
} else {
  process.stderr.write(`Reproduction script: ${script}\n`);
}
process.exitCode = passed ? 0 : 1;
