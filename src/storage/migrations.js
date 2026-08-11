import { KEYS } from './keys.js';
import { CURRENT_SCHEMA_VERSION } from './schema.js';

/**
 * Forward-only, additive migrations. New fields get defaults; nothing is ever
 * renamed in place. If one throws, the app carries on with withDefaults()
 * filling the gaps - silent data loss is worse than a stale schema.
 *
 * The store is injected so this can be tested against an in-memory fake.
 */

export const MIGRATIONS = [
  // { to: 2, migrate: async (store) => { ... } },
];

export const runMigrations = async (store) => {
  const raw = await store.readRaw(KEYS.schemaVersion, null);
  const from = Number(raw) || 0;

  if (from === 0) {
    // Nothing stored yet: stamp the current version and skip the ladder.
    await store.writeRaw(KEYS.schemaVersion, String(CURRENT_SCHEMA_VERSION));
    return { from: CURRENT_SCHEMA_VERSION, to: CURRENT_SCHEMA_VERSION, ran: 0, fresh: true };
  }

  if (from >= CURRENT_SCHEMA_VERSION) {
    return { from, to: from, ran: 0, fresh: false };
  }

  let ran = 0;
  for (const migration of MIGRATIONS) {
    if (migration.to <= from) continue;
    try {
      await migration.migrate(store);
      ran++;
    } catch (error) {
      return { from, to: from, ran, failedAt: migration.to, fresh: false };
    }
  }

  await store.writeRaw(KEYS.schemaVersion, String(CURRENT_SCHEMA_VERSION));
  return { from, to: CURRENT_SCHEMA_VERSION, ran, fresh: false };
};
