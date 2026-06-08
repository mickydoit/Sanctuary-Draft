# LBH Club — World Cup Draft

A 5-player fantasy draft for the 2026 FIFA World Cup. Draft your teams in a
snake order, then earn points as your nations win through the tournament.

This is a **static web app** (plain HTML/CSS/JS) hosted free on **GitHub Pages**,
with **Supabase** (free hosted Postgres) holding the shared draft + scores so all
five of you see the same live ladder from your own phones.

- **Ladder** — live points table.
- **Fixtures** — every match with the owner overlay (e.g. *France vs Iraq = DeWet vs —*), kickoff times in AEST.
- **Bracket** — the knockout tree (R32 → Final + 3rd place), advancing team highlighted.
- **Draft room** — random order, then snake (1-2-3-4-5, 5-4-3-2-1, …), 9 teams each.
- **Admin** — start/reset the draft, edit player names, enter scores, add knockout matches, settings.

## Scoring

| Stage | Win | Draw |
|---|---|---|
| Group | 1 | 0.5 |
| Round of 32 | 1 | — |
| Round of 16 | 2 | — |
| Quarter-final | 3 | — |
| Semi-final | 4 | — |
| Third-place playoff | 1 | — |
| Final | 5 | — |

Knockouts decided by penalties: the team that advances takes the full win
points. If you own **both** teams in a match it's a guaranteed result — any
decisive result scores the full win points (whichever of your teams wins), and
a draw scores 0.5.

## Hosting — it's already on GitHub Pages

GitHub Pages serves this repo's **root**, so the site is live at:

> **https://jakepapgrv.github.io/lbh-club-world-cup/**

(If Pages ever needs re-enabling: repo **Settings → Pages → Build and deployment
→ Deploy from a branch → `main` / `/ (root)`**.)

Every push to `main` redeploys automatically.

## One-time setup: connect Supabase (so the 5 of you share data)

Without this, the app still runs — but data lives only in **each person's own
browser**, so you wouldn't share a ladder. Do this once before the real draft:

1. Create a free project at **https://supabase.com**.
2. In Supabase, open **SQL Editor → New query**, paste the entire contents of
   [`supabase-schema.sql`](supabase-schema.sql), and **Run**. This creates the
   tables and seeds the 5 players, 48 teams, and all 72 group fixtures.
3. In Supabase, go to **Project Settings → API** and copy two values:
   - **Project URL**
   - the **`anon` public** API key (safe to commit — it's designed for the browser)
4. Edit [`config.js`](config.js) and paste them in, plus pick an admin password:
   ```js
   window.LBH_CONFIG = {
     SUPABASE_URL: 'https://YOURPROJECT.supabase.co',
     SUPABASE_ANON_KEY: 'eyJ...the long anon key...',
     ADMIN_PASSWORD: 'pick-something',
   };
   ```
5. Commit + push `config.js`. Within a minute the live site is shared across everyone.

The Admin page shows **`supabase · shared`** when it's connected, or
**`local · this device only`** when `config.js` is still blank.

## Running the draft

1. Open the site, click **Admin**, log in with your `ADMIN_PASSWORD`.
2. **Draft Room → Start draft** randomises the order and begins the snake. Run a
   practice draft if you like, then **Reset draft** and do the real one. Teams
   lock in automatically once all 45 picks are made (3 nations stay undrafted).
3. During the tournament, results arrive automatically if you've set up the score
   sync (see **Automatic score updates** below) — group scores, knockout ties as
   they're drawn, and the advancing team. You can always enter or correct a result
   by hand on **Admin → Enter scores** (and add a knockout tie on **Admin → Add a
   knockout match**); pick the team that advances — that's who gets the points,
   including penalty wins. The Ladder and Fixtures pages refresh themselves every
   minute.

## Run it locally

It's static, so any local web server works. With Node installed:

```bash
npx http-server . -p 5173 -c-1
```

Then open http://localhost:5173. With `config.js` blank it uses in-browser
storage (great for a solo test); fill in Supabase to share.

## Automatic score updates (GitHub Actions + football-data.org)

A scheduled GitHub Action ([`.github/workflows/sync-scores.yml`](.github/workflows/sync-scores.yml))
polls **football-data.org** (whose free tier covers the World Cup) and writes
results straight into Supabase — group scores, the advancing team in knockouts,
and new knockout ties as the bracket is drawn. Manual entry on **Admin → Enter
scores** still works and takes priority: the sync never overwrites a result the
API hasn't finished yet.

**How fresh:** GitHub's cron can't fire more often than every 5 minutes, so each
run polls in a loop every ~60 seconds for its 5-minute window. Back-to-back runs
give near-continuous, ~1-minute-resolution updates, so a finished result lands in
Supabase within ~1 minute of the provider marking it final — and the
Ladder/Fixtures pages already refresh every minute, so the app updates on its own
shortly after full time. (To poll less aggressively, widen the loop/cron in the
workflow.)

**One-time setup** — add two repository secrets (repo **Settings → Secrets and
variables → Actions → New repository secret**):

| Secret | Value |
|---|---|
| `FOOTBALL_DATA_TOKEN` | A free API token from <https://www.football-data.org/client/register> — register and it's emailed to you. |
| `DATABASE_URL` | Your Supabase **Postgres connection string** — **not** the API URL. In Supabase, click the green **Connect** button (top of the dashboard), open the **Session pooler** option, and copy the URI. It looks like `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`. Replace `[YOUR-PASSWORD]` with your database password (use a letters-and-numbers-only password to avoid URL-encoding issues; reset it via **Connect → Session pooler** / the database settings). Use the **Session pooler** (it's IPv4 — GitHub's runners can't reach the IPv6-only direct connection). |

That's it — the workflow runs on schedule, and you can trigger it any time from
the repo's **Actions → Sync World Cup scores → Run workflow** button. Watch a run's
log for a one-line summary (`fetched=… updated=… inserted=…`).

> ⚠️ If the log prints `fetched=0`, the provider returned no World Cup matches —
> for football-data.org that usually means the fixtures aren't published yet (they
> appear closer to kickoff) or the token is invalid. Manual entry remains the
> fallback. (SportMonks is also supported — set `SCORE_PROVIDER=sportmonks` and a
> `SPORTMONKS_TOKEN` secret — but its free tier does **not** include the World Cup.)

The first sync also links the provider's team/fixture ids onto the seeded rows
(matched by FIFA code/name). If a team can't be matched, the log names it — add
the spelling to the table in [`src/data/fifaRankings.js`](src/data/fifaRankings.js).

To run it by hand locally:

```bash
DATABASE_URL="postgres://…supabase…" FOOTBALL_DATA_TOKEN="…" npm run sync
```

## Project layout

- `index.html`, `config.js`, `assets/` — the live static app.
  - `assets/js/lib/` — the pure rules engine (`draft.js`, `scoring.js`,
    `fixtures.js`) and team data (`teams.js`), reused unchanged from the original.
  - `assets/js/store.js` — data layer (Supabase, with a localStorage fallback).
  - `assets/js/compute.js`, `views.js`, `app.js` — view-models, rendering, router.
- `supabase-schema.sql` — generated by `scripts/gen-supabase-sql.mjs`.
- `scripts/sync-scores.mjs` — the score-sync entry point run by the GitHub Action.
  It reuses `src/api/sync.js` (provider fetch + id mapping + result writing),
  `src/db/index.js` (Postgres connection), and `src/data/` (teams + rankings).
- `src/`, `views/`, `package.json` — the Node/Express + Postgres version
  (previously deployed on Render). Its **web server** (`src/server.js`, `views/`)
  is no longer deployed, but the score sync above reuses its API/DB/data modules,
  and it's still the source of the rules engine + the SQL generator.

## Regenerating the SQL seed

If you change `src/data/teams.js`, regenerate the seed:

```bash
node scripts/gen-supabase-sql.mjs
```
