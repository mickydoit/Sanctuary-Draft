import { Router } from 'express';
import { requireAdmin } from '../middleware.js';
import { getDraftState, startDraft, makePick } from '../repo.js';
import { resetDraft } from '../db/reset.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const state = await getDraftState();
    res.render('draft', { title: 'Draft Room', active: 'draft', ...state });
  } catch (err) {
    next(err);
  }
});

router.post('/start', requireAdmin, async (req, res, next) => {
  try {
    await startDraft();
    res.redirect('/draft');
  } catch (err) {
    next(err);
  }
});

router.post('/pick', requireAdmin, async (req, res, next) => {
  try {
    await makePick(Number(req.body.teamId));
    res.redirect('/draft');
  } catch (err) {
    next(err);
  }
});

router.post('/reset', requireAdmin, async (req, res, next) => {
  try {
    await resetDraft();
    res.redirect('/draft');
  } catch (err) {
    next(err);
  }
});

export default router;
