'use strict';
/**
 * A tiny ES-module loader for plain `node`, so the pure logic in src/game and
 * src/storage can be tested with no test framework and no dev dependencies.
 *
 * The project ships ES modules but is a CommonJS package, so `require()` can't
 * read them. This resolves relative `.js`/`.json` imports recursively, strips
 * the `export` keywords, and evaluates each module once.
 *
 * Deliberately limited: it only understands the import/export forms this
 * codebase actually uses, and throws a clear error on anything else. It is a
 * test harness, not a bundler.
 */
const fs = require('fs');
const path = require('path');

const cache = new Map();

const IMPORT_FROM = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/g;
const IMPORT_BARE = /import\s+['"][^'"]+['"];?/g;

const resolveSpecifier = (fromDir, specifier) => {
  if (!specifier.startsWith('.')) {
    throw new Error(
      `tests/load.js resolves relative imports only, got "${specifier}". ` +
        `A module importing react/react-native cannot be tested under node.`,
    );
  }
  return path.resolve(fromDir, specifier);
};

/** Turns an import clause into `const` declarations bound to a dependency ref. */
const bindingsFor = (clause, ref) => {
  const lines = [];
  const trimmed = clause.trim();
  const braceAt = trimmed.indexOf('{');
  const defaultPart = (braceAt === -1 ? trimmed : trimmed.slice(0, braceAt))
    .replace(/,\s*$/, '')
    .trim();

  if (defaultPart.startsWith('* as ')) {
    lines.push(`const ${defaultPart.slice(5).trim()} = ${ref};`);
  } else if (defaultPart) {
    lines.push(`const ${defaultPart} = ${ref}.default;`);
  }

  if (braceAt !== -1) {
    const named = trimmed.slice(braceAt + 1, trimmed.lastIndexOf('}'));
    const parts = named
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const aliased = entry.split(/\s+as\s+/);
        return aliased.length === 2 ? `${aliased[0]}: ${aliased[1]}` : entry;
      });
    if (parts.length) lines.push(`const { ${parts.join(', ')} } = ${ref};`);
  }

  return lines.join('\n');
};

/** @returns the module's namespace object ({ named..., default }). */
const loadModule = (modulePath) => {
  const absolute = path.resolve(modulePath);
  if (cache.has(absolute)) return cache.get(absolute);

  if (absolute.endsWith('.json')) {
    const namespace = { default: JSON.parse(fs.readFileSync(absolute, 'utf8')) };
    cache.set(absolute, namespace);
    return namespace;
  }

  const source = fs.readFileSync(absolute, 'utf8');
  const directory = path.dirname(absolute);
  const dependencies = [];

  let body = source.replace(IMPORT_FROM, (match, clause, specifier) => {
    const index = dependencies.length;
    dependencies.push(loadModule(resolveSpecifier(directory, specifier)));
    return bindingsFor(clause, `__dep${index}`);
  });
  body = body.replace(IMPORT_BARE, '');

  const exported = new Set();
  for (const m of source.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)/g)) exported.add(m[1]);
  for (const m of source.matchAll(/export\s+function\s+([A-Za-z0-9_$]+)/g)) exported.add(m[1]);

  // Any expression works: an identifier, a function, or a bare string literal
  // (which is how the generated word lists are shipped).
  const hasDefault = /export\s+default\s/.test(body);
  body = body.replace(/export\s+default\s+/g, 'const __default = ');
  body = body.replace(/\bexport\s+(const|function|class|let)\b/g, '$1');

  if (/\bexport\b/.test(body)) {
    throw new Error(`tests/load.js met an unsupported export form in ${absolute}`);
  }

  const fields = [...exported];
  if (hasDefault) fields.push('default: __default');
  const tail = `\n;module.exports = { ${fields.join(', ')} };`;

  const parameters = dependencies.map((_, index) => `__dep${index}`);
  const factory = new Function('module', ...parameters, body + tail);
  const container = { exports: {} };
  factory(container, ...dependencies);

  cache.set(absolute, container.exports);
  return container.exports;
};

/** Convenience: load a module by path relative to the repo root. */
const loadSrc = (relativePath) => loadModule(path.join(__dirname, '..', relativePath));

module.exports = { loadModule, loadSrc };
