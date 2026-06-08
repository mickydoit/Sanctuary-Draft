import dotenv from 'dotenv';

dotenv.config();

// Dual-mode database, behind a small uniform interface (query + withTransaction):
//   - DATABASE_URL set   -> real Postgres via `pg` (Render, or your own instance).
//   - DATABASE_URL unset -> PGlite, real Postgres compiled to WASM, running
//     in-process for a zero-setup local test run. NOTE: in-memory; data does
//     NOT persist across restarts.
let backendPromise;

async function initBackend() {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    const pg = (await import('pg')).default;
    const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
    const pool = new pg.Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    });
    return {
      query: (text, params) => pool.query(text, params),
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn({ query: (t, p) => client.query(t, p) });
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
    };
  }

  console.warn(
    '[db] DATABASE_URL not set — using in-memory Postgres (PGlite). ' +
      'Data will NOT persist across restarts. Use this for the test run only.'
  );
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.waitReady;
  return {
    query: (text, params) => db.query(text, params ?? []),
    transaction: (fn) => db.transaction((tx) => fn({ query: (t, p) => tx.query(t, p ?? []) })),
  };
}

function getBackend() {
  if (!backendPromise) backendPromise = initBackend();
  return backendPromise;
}

export async function query(text, params) {
  return (await getBackend()).query(text, params);
}

/** Run statements atomically. `fn` receives an object with `.query(text, params)`. */
export async function withTransaction(fn) {
  return (await getBackend()).transaction(fn);
}

export const usingInMemory = () => !process.env.DATABASE_URL;
