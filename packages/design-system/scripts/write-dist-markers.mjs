import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const markers = [
  ['dist/cjs', { type: 'commonjs' }],
  ['dist/esm', { type: 'module' }],
];

for (const [relativeDir, contents] of markers) {
  const target = join(packageRoot, relativeDir, 'package.json');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(contents, null, 2)}\n`, 'utf8');
}
