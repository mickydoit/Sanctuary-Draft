import { Router } from 'express';

const router = Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

router.get('/login', (req, res) => {
  res.render('login', { title: 'Login', active: '', next: req.query.next || '/', error: null });
});

router.post('/login', (req, res) => {
  const next = req.body.next || '/';
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect(next);
  }
  res.status(401).render('login', { title: 'Login', active: '', next, error: 'Incorrect password.' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

export default router;
