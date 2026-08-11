'use strict';
/**
 * Runs every tests/*.test.js and exits non-zero if anything failed.
 *
 * A test file may export an async function for checks that need to await;
 * it is called after the synchronous body of every file has run.
 */
const fs = require('fs');
const path = require('path');
const { state } = require('./harness.js');

const files = fs
  .readdirSync(__dirname)
  .filter((name) => name.endsWith('.test.js'))
  .sort();

const main = async () => {
  const started = Date.now();

  for (const file of files) {
    const exported = require(path.join(__dirname, file));
    if (typeof exported === 'function') await exported();
    else if (exported && typeof exported.run === 'function') await exported.run();
  }

  const elapsed = Date.now() - started;
  console.log(`\n${'-'.repeat(56)}`);
  if (state.failed === 0) {
    console.log(
      `All ${state.passed} checks passed across ${files.length} suites (${elapsed}ms).`,
    );
  } else {
    console.log(`${state.failed} of ${state.passed + state.failed} checks FAILED:`);
    state.failures.forEach((failure) => console.log(`  - ${failure}`));
  }
  process.exit(state.failed ? 1 : 0);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
