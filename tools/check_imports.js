'use strict';
/**
 * Cross-checks every local import against what the target file actually
 * exports.
 *
 *   node tools/check_imports.js
 *
 * Metro bundles a missing named export happily and it becomes `undefined` at
 * runtime - which surfaces as "undefined is not a function" somewhere far from
 * the cause. This catches it before the app is launched.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ROOTS = ['App.js', 'index.js', 'src'];

const collect = (target, files = []) => {
  const full = path.join(ROOT, target);
  if (!fs.existsSync(full)) return files;
  if (fs.statSync(full).isDirectory()) {
    fs.readdirSync(full).forEach((entry) => collect(path.join(target, entry), files));
  } else if (full.endsWith('.js')) {
    files.push(full);
  }
  return files;
};

const exportsOf = (file) => {
  const source = fs.readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of source.matchAll(/export\s+(?:const|let|function|class)\s+([A-Za-z0-9_$]+)/g)) {
    names.add(m[1]);
  }
  for (const m of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    m[1]
      .split(',')
      .map((entry) => entry.trim().split(/\s+as\s+/).pop().trim())
      .filter(Boolean)
      .forEach((name) => names.add(name));
  }
  if (/export\s+default\s/.test(source)) names.add('default');
  return names;
};

const problems = [];
const files = ROOTS.flatMap((entry) => collect(entry));

files.forEach((file) => {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(ROOT, file);

  // Matches EVERY import, not just relative ones - otherwise the lazy clause
  // match runs across intervening `import ... from 'react'` statements.
  for (const match of source.matchAll(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const [, clause, specifier] = match;
    if (!specifier.startsWith('.')) continue;

    const base = path.resolve(path.dirname(file), specifier);
    const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')];
    const resolved = candidates.find(
      (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    );

    if (!resolved) {
      problems.push(`${relative}: cannot resolve "${specifier}"`);
      continue;
    }
    if (resolved.endsWith('.json')) continue;

    const available = exportsOf(resolved);
    const clean = clause.trim();
    const braceAt = clean.indexOf('{');

    const defaultPart = (braceAt === -1 ? clean : clean.slice(0, braceAt))
      .replace(/,\s*$/, '')
      .trim();
    if (defaultPart && !defaultPart.startsWith('*') && !available.has('default')) {
      problems.push(`${relative}: "${specifier}" has no default export`);
    }

    if (braceAt !== -1) {
      clean
        .slice(braceAt + 1, clean.lastIndexOf('}'))
        .split(',')
        .map((entry) => entry.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean)
        .forEach((name) => {
          if (!available.has(name)) {
            problems.push(`${relative}: "${specifier}" does not export ${name}`);
          }
        });
    }
  }
});

console.log(`checked ${files.length} files`);
if (problems.length === 0) {
  console.log('every local import resolves.');
  process.exit(0);
}
problems.forEach((problem) => console.log(`  ${problem}`));
console.log(`\n${problems.length} problem(s).`);
process.exit(1);
