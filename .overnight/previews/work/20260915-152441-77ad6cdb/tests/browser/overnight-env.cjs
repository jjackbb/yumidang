// Runs another browser check with the overnight defaults when the shell did not export them,
// so older scripts never fall back to writing into the user's own evidence folders.
// Usage: node tests/browser/overnight-env.cjs tests/browser/conversations.cjs
const path = require('path');

const target = process.argv[2];
if (!target) {
  console.error('usage: node tests/browser/overnight-env.cjs <browser-check.cjs>');
  process.exit(2);
}
process.env.CHECK_URL ||= 'http://127.0.0.1:4186/?demo=1';
process.env.EVIDENCE_DIR ||= path.resolve(__dirname, '../../docs/overnight/evidence');
process.env.PLAYWRIGHT_MODULE ||= '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
process.env.BROWSER_EXECUTABLE ||= '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';
console.log(`overnight-env: ${target} → ${process.env.CHECK_URL}, evidence ${process.env.EVIDENCE_DIR}`);
require(path.resolve(target));
