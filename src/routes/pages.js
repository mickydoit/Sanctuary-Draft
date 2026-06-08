import { Router } from 'express';
import { getLadder, getFixturesView, getBracket } from '../repo.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const ladder = await getLadder();
    res.render('ladder', { title: 'Ladder', active: 'ladder', ladder });
  } catch (err) {
    next(err);
  }
});

router.get('/fixtures', async (req, res, next) => {
  try {
    const groups = await getFixturesView();
    res.render('fixtures', { title: 'Fixtures', active: 'fixtures', groups });
  } catch (err) {
    next(err);
  }
});

router.get('/bracket', async (req, res, next) => {
  try {
    const bracket = await getBracket();
    res.render('bracket', { title: 'Bracket', active: 'bracket', ...bracket });
  } catch (err) {
    next(err);
  }
});

export default router;
