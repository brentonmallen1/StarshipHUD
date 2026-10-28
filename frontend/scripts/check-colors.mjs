// Fails when a stylesheet hardcodes a colour. Colours are defined once as
// tokens (styles/index.css, styles/themes.css); everything else uses var() /
// color-mix() so ship themes reach every widget.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('../src', import.meta.url).pathname;
const TOKEN_FILES = new Set(['styles/index.css', 'styles/themes.css']);
const LITERAL = /#[0-9a-f]{3,8}\b|\brgba?\(\s*\d|\bhsla?\(\s*\d|:\s*[^;]*\b(white|black|gray|grey|red|green|blue|yellow|orange|cyan|magenta)\s*[;!]/i;

function* cssFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* cssFiles(path);
    else if (entry.name.endsWith('.css')) yield path;
  }
}

const problems = [];
for (const file of cssFiles(SRC)) {
  const rel = relative(SRC, file);
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\*.*?\*\//g, '').trim();
    if (!code || code.startsWith('/*') || code.startsWith('*')) return;
    // Token files may define colours, but only in custom properties
    if (TOKEN_FILES.has(rel) && code.startsWith('--')) return;
    if (LITERAL.test(code)) problems.push(`src/${rel}:${i + 1}  ${code}`);
  });
}

if (problems.length) {
  console.error(`Hardcoded colours (use a token from styles/index.css instead):\n${problems.join('\n')}`);
  process.exit(1);
}
