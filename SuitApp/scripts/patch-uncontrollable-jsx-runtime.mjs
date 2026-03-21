import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LEGACY_BLOCK_PATTERN = /,\s*__source:\s*\{\s*fileName:\s*_jsxFileName,\s*lineNumber:\s*\d+\s*\},\s*__self:\s*this/gm;
const LEGACY_JSX_RUNTIME_TARGETS = [
  /\/node_modules\/uncontrollable\/lib\/(?:esm|cjs)\/uncontrollable\.js$/,
  /\/node_modules\/react-big-calendar\/dist\/react-big-calendar\.js$/,
  /\/node_modules\/\.vite\/deps\/react-big-calendar(?:-[^/]+)?\.js$/,
];

export function stripLegacyJsxDevProps(source) {
  return source.replace(LEGACY_BLOCK_PATTERN, '');
}

export function shouldTransformLegacyJsxRuntimeModule(id) {
  if (typeof id !== 'string') return false;
  const normalizedId = id.replace(/\\/g, '/');
  return LEGACY_JSX_RUNTIME_TARGETS.some((pattern) => pattern.test(normalizedId));
}

export function transformLegacyJsxRuntimeModule(id, source) {
  if (!shouldTransformLegacyJsxRuntimeModule(id)) {
    return null;
  }

  const patched = stripLegacyJsxDevProps(source);
  return patched === source ? null : patched;
}

export function patchFile(filePath) {
  const current = fs.readFileSync(filePath, 'utf8');
  const patched = stripLegacyJsxDevProps(current);

  if (patched === current) {
    return false;
  }

  fs.writeFileSync(filePath, patched, 'utf8');
  return true;
}

export function runPatch(baseDir = process.cwd()) {
  const targets = [
    path.join(baseDir, 'node_modules/uncontrollable/lib/esm/uncontrollable.js'),
    path.join(baseDir, 'node_modules/uncontrollable/lib/cjs/uncontrollable.js'),
    path.join(baseDir, 'node_modules/react-big-calendar/dist/react-big-calendar.js'),
    path.join(baseDir, 'node_modules/.vite/deps/react-big-calendar.js'),
  ];

  const results = [];

  for (const target of targets) {
    if (!fs.existsSync(target)) {
      results.push({ file: target, status: 'missing' });
      continue;
    }

    const changed = patchFile(target);
    results.push({ file: target, status: changed ? 'patched' : 'already_patched' });
  }

  return results;
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  const results = runPatch();

  for (const result of results) {
    console.log(`[patch-uncontrollable] ${result.status}: ${result.file}`);
  }
}
