import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { query } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Create all tables (idempotent — schema uses IF NOT EXISTS). */
export async function ensureSchema() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  // Run statements one at a time so it works on engines that don't accept
  // multiple statements per query (the schema has no semicolons inside literals).
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await query(stmt);
  }
}

// Allow running directly: `npm run db:setup`
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('setup.js')) {
  ensureSchema()
    .then(() => {
      console.log('Schema ready.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
