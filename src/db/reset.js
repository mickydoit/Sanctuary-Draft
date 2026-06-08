import { query } from './index.js';

/**
 * Reset the DRAFT only: clears all picks + nominations and returns the draft to
 * "not started". Teams, players and fixtures are left intact. Use this between
 * test runs, and once more before the real draft.
 */
export async function resetDraft() {
  await query('DELETE FROM nominations');
  await query('DELETE FROM picks');
  await query('UPDATE players SET draft_slot = NULL');
  await query("UPDATE settings SET draft_status='not_started', draft_started_at=NULL WHERE id=1");
}

// Allow running directly: `npm run db:reset`
if (process.argv[1]?.endsWith('reset.js')) {
  resetDraft()
    .then(() => {
      console.log('Draft reset.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
