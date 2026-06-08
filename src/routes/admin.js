import { Router } from 'express';
import { requireAdmin } from '../middleware.js';
import { getAdminData, setScore, updatePlayerNames, setThirdPlace } from '../repo.js';
import { seed } from '../db/seed.js';
import { importFromApi, syncFromApi, scoreProviderStatus } from '../api/sync.js';

const router = Router();
router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const data = await getAdminData();
    const provider = scoreProviderStatus();
    res.render('admin', {
      title: 'Admin',
      active: 'admin',
      ...data,
      tokenSet: provider.tokenSet,
      providerName: provider.name,
      notice: req.query.ok || null,
      problem: req.query.err || null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/import', async (req, res, next) => {
  try {
    const r = await importFromApi();
    res.redirect(`/admin?ok=${encodeURIComponent(`Imported ${r.teams} teams and ${r.fixtures} fixtures.`)}`);
  } catch (err) {
    res.redirect(`/admin?err=${encodeURIComponent(err.message)}`);
  }
});

router.post('/sync', async (req, res, next) => {
  try {
    const r = await syncFromApi();
    res.redirect(`/admin?ok=${encodeURIComponent(`Sync done: ${r.updated} updated, ${r.inserted} new fixture(s).`)}`);
  } catch (err) {
    res.redirect(`/admin?err=${encodeURIComponent(err.message)}`);
  }
});

router.post('/score', async (req, res, next) => {
  try {
    const { fixtureId, homeScore, awayScore, winnerTeamId } = req.body;
    await setScore(
      Number(fixtureId),
      Number(homeScore),
      Number(awayScore),
      winnerTeamId ? Number(winnerTeamId) : null
    );
    res.redirect('/admin#fx-' + fixtureId);
  } catch (err) {
    next(err);
  }
});

router.post('/players', async (req, res, next) => {
  try {
    await updatePlayerNames(req.body);
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

router.post('/settings', async (req, res, next) => {
  try {
    await setThirdPlace(Boolean(req.body.scoreThirdPlace));
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

router.post('/reseed', async (req, res, next) => {
  try {
    await seed();
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

export default router;
