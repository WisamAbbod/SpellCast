'use strict';
/** Minimal assertion recorder shared by every *.test.js file. */

const state = { passed: 0, failed: 0, failures: [], suite: '' };

const suite = (name) => {
  state.suite = name;
  console.log(`\n${name}`);
};

const record = (label, passedCheck, detail) => {
  if (passedCheck) {
    state.passed++;
    console.log(`  PASS  ${label}`);
  } else {
    state.failed++;
    state.failures.push(`${state.suite} > ${label}`);
    console.log(`  FAIL  ${label}`);
    if (detail) console.log(detail);
  }
};

/** Compares with === after stringifying non-primitives. */
const check = (label, actual, expected) => {
  const a = typeof actual === 'object' && actual !== null ? JSON.stringify(actual) : actual;
  const b = typeof expected === 'object' && expected !== null ? JSON.stringify(expected) : expected;
  record(label, a === b, `        expected ${b}\n        actual   ${a}`);
};

const ok = (label, condition, detail) => record(label, !!condition, detail);

const throws = (label, fn) => {
  try {
    fn();
    record(label, false, '        expected a throw, got none');
  } catch (error) {
    record(label, true);
  }
};

module.exports = { state, suite, check, ok, throws };
