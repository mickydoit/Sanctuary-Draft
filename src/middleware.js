/** Expose common values to every template. */
export function attachLocals(req, res, next) {
  res.locals.isAdmin = Boolean(req.session?.isAdmin);
  res.locals.active = '';
  next();
}

/** Gate mutating routes behind the admin password. */
export function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}
