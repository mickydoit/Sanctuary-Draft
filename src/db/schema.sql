-- World Cup Draft schema. Safe to run repeatedly (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS players (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  draft_slot  INTEGER,                 -- 1..N randomised pick order, set when the draft starts
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id       SERIAL PRIMARY KEY,
  name     TEXT NOT NULL UNIQUE,
  code     TEXT,                       -- 3-letter code, e.g. AUS
  grp      TEXT,                       -- group letter A..L
  ranking  INTEGER,                    -- FIFA world ranking (1 = best)
  api_id   TEXT                        -- id used by the football data API for sync
);

CREATE TABLE IF NOT EXISTS picks (
  id           SERIAL PRIMARY KEY,
  pick_number  INTEGER NOT NULL UNIQUE,
  round        INTEGER NOT NULL,
  player_id    INTEGER NOT NULL REFERENCES players(id),
  team_id      INTEGER NOT NULL REFERENCES teams(id) UNIQUE,  -- each team drafted at most once
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fixtures (
  id             SERIAL PRIMARY KEY,
  api_id         TEXT UNIQUE,
  stage          TEXT NOT NULL,        -- group,R32,R16,QF,SF,third,final
  grp            TEXT,
  matchday       INTEGER,
  kickoff        TIMESTAMPTZ,
  home_team_id   INTEGER REFERENCES teams(id),
  away_team_id   INTEGER REFERENCES teams(id),
  home_score     INTEGER,
  away_score     INTEGER,
  winner_team_id INTEGER REFERENCES teams(id),   -- knockouts only (incl. penalty wins)
  status         TEXT NOT NULL DEFAULT 'scheduled', -- scheduled,live,finished
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Which team a player nominated to win an own-vs-own fixture.
CREATE TABLE IF NOT EXISTS nominations (
  fixture_id  INTEGER NOT NULL REFERENCES fixtures(id),
  player_id   INTEGER NOT NULL REFERENCES players(id),
  team_id     INTEGER NOT NULL REFERENCES teams(id),
  PRIMARY KEY (fixture_id, player_id)
);

-- Single-row application state.
CREATE TABLE IF NOT EXISTS settings (
  id                 INTEGER PRIMARY KEY DEFAULT 1,
  draft_status       TEXT NOT NULL DEFAULT 'not_started', -- not_started,in_progress,complete
  draft_started_at   TIMESTAMPTZ,
  score_third_place  BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT settings_singleton CHECK (id = 1)
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
