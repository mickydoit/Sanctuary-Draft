-- LBH Club — World Cup Draft : fix group fixtures (NON-DESTRUCTIVE).
-- Paste this whole file into the Supabase SQL Editor and run it once.
--
-- It replaces ONLY the group-stage fixtures with the real 2026 schedule.
-- Your teams, players, PICKS (the completed draft), nominations and settings
-- are left completely untouched. Knockout fixtures (if any have been added
-- later) are also preserved.

begin;

-- Out with the old placeholder group fixtures (nominations cascade, but there
-- are none pre-tournament; picks reference teams, not fixtures, so are safe).
delete from fixtures where stage = 'group';

-- In with the 72 real group fixtures (ids 1..72, chronological).
insert into fixtures (id, stage, grp, matchday, kickoff, home_team_id, away_team_id) values
  (1, 'group', 'A', 1, '2026-06-11T19:00:00Z', 14, 40),
  (2, 'group', 'A', 1, '2026-06-12T02:00:00Z', 23, 33),
  (3, 'group', 'B', 1, '2026-06-12T19:00:00Z', 27, 43),
  (4, 'group', 'D', 1, '2026-06-13T01:00:00Z', 15, 32),
  (5, 'group', 'B', 1, '2026-06-13T19:00:00Z', 38, 18),
  (6, 'group', 'C', 1, '2026-06-13T22:00:00Z', 6, 8),
  (7, 'group', 'C', 1, '2026-06-14T01:00:00Z', 47, 34),
  (8, 'group', 'D', 1, '2026-06-14T04:00:00Z', 24, 20),
  (9, 'group', 'E', 1, '2026-06-14T17:00:00Z', 10, 46),
  (10, 'group', 'F', 1, '2026-06-14T20:00:00Z', 7, 17),
  (11, 'group', 'E', 1, '2026-06-14T23:00:00Z', 30, 21),
  (12, 'group', 'F', 1, '2026-06-15T02:00:00Z', 31, 35),
  (13, 'group', 'H', 1, '2026-06-15T16:00:00Z', 2, 44),
  (14, 'group', 'G', 1, '2026-06-15T19:00:00Z', 9, 26),
  (15, 'group', 'H', 1, '2026-06-15T22:00:00Z', 41, 16),
  (16, 'group', 'G', 1, '2026-06-16T01:00:00Z', 19, 48),
  (17, 'group', 'I', 1, '2026-06-16T19:00:00Z', 1, 13),
  (18, 'group', 'I', 1, '2026-06-16T22:00:00Z', 39, 28),
  (19, 'group', 'J', 1, '2026-06-17T01:00:00Z', 3, 25),
  (20, 'group', 'J', 1, '2026-06-17T04:00:00Z', 22, 42),
  (21, 'group', 'K', 1, '2026-06-17T17:00:00Z', 5, 36),
  (22, 'group', 'L', 1, '2026-06-17T20:00:00Z', 4, 11),
  (23, 'group', 'L', 1, '2026-06-17T23:00:00Z', 45, 29),
  (24, 'group', 'K', 1, '2026-06-18T02:00:00Z', 37, 12),
  (25, 'group', 'A', 2, '2026-06-18T16:00:00Z', 33, 40),
  (26, 'group', 'B', 2, '2026-06-18T19:00:00Z', 18, 43),
  (27, 'group', 'B', 2, '2026-06-18T22:00:00Z', 27, 38),
  (28, 'group', 'A', 2, '2026-06-19T01:00:00Z', 14, 23),
  (29, 'group', 'D', 2, '2026-06-19T19:00:00Z', 15, 24),
  (30, 'group', 'C', 2, '2026-06-19T22:00:00Z', 34, 8),
  (31, 'group', 'C', 2, '2026-06-20T00:30:00Z', 6, 47),
  (32, 'group', 'D', 2, '2026-06-20T03:00:00Z', 20, 32),
  (33, 'group', 'F', 2, '2026-06-20T17:00:00Z', 7, 31),
  (34, 'group', 'E', 2, '2026-06-20T20:00:00Z', 10, 30),
  (35, 'group', 'E', 2, '2026-06-21T00:00:00Z', 21, 46),
  (36, 'group', 'F', 2, '2026-06-21T04:00:00Z', 35, 17),
  (37, 'group', 'H', 2, '2026-06-21T16:00:00Z', 2, 41),
  (38, 'group', 'G', 2, '2026-06-21T19:00:00Z', 9, 19),
  (39, 'group', 'H', 2, '2026-06-21T22:00:00Z', 16, 44),
  (40, 'group', 'G', 2, '2026-06-22T01:00:00Z', 48, 26),
  (41, 'group', 'J', 2, '2026-06-22T17:00:00Z', 3, 22),
  (42, 'group', 'I', 2, '2026-06-22T21:00:00Z', 1, 39),
  (43, 'group', 'I', 2, '2026-06-23T00:00:00Z', 28, 13),
  (44, 'group', 'J', 2, '2026-06-23T03:00:00Z', 42, 25),
  (45, 'group', 'K', 2, '2026-06-23T17:00:00Z', 5, 37),
  (46, 'group', 'L', 2, '2026-06-23T20:00:00Z', 4, 45),
  (47, 'group', 'L', 2, '2026-06-23T23:00:00Z', 29, 11),
  (48, 'group', 'K', 2, '2026-06-24T02:00:00Z', 12, 36),
  (49, 'group', 'B', 3, '2026-06-24T19:00:00Z', 18, 27),
  (50, 'group', 'B', 3, '2026-06-24T19:00:00Z', 43, 38),
  (51, 'group', 'C', 3, '2026-06-24T22:00:00Z', 34, 6),
  (52, 'group', 'C', 3, '2026-06-24T22:00:00Z', 8, 47),
  (53, 'group', 'A', 3, '2026-06-25T01:00:00Z', 33, 14),
  (54, 'group', 'A', 3, '2026-06-25T01:00:00Z', 40, 23),
  (55, 'group', 'E', 3, '2026-06-25T20:00:00Z', 46, 30),
  (56, 'group', 'E', 3, '2026-06-25T20:00:00Z', 21, 10),
  (57, 'group', 'F', 3, '2026-06-25T23:00:00Z', 17, 31),
  (58, 'group', 'F', 3, '2026-06-25T23:00:00Z', 35, 7),
  (59, 'group', 'D', 3, '2026-06-26T02:00:00Z', 20, 15),
  (60, 'group', 'D', 3, '2026-06-26T02:00:00Z', 32, 24),
  (61, 'group', 'I', 3, '2026-06-26T19:00:00Z', 28, 1),
  (62, 'group', 'I', 3, '2026-06-26T19:00:00Z', 13, 39),
  (63, 'group', 'H', 3, '2026-06-27T00:00:00Z', 44, 41),
  (64, 'group', 'H', 3, '2026-06-27T00:00:00Z', 16, 2),
  (65, 'group', 'G', 3, '2026-06-27T03:00:00Z', 26, 19),
  (66, 'group', 'G', 3, '2026-06-27T03:00:00Z', 48, 9),
  (67, 'group', 'L', 3, '2026-06-27T21:00:00Z', 29, 4),
  (68, 'group', 'L', 3, '2026-06-27T21:00:00Z', 11, 45),
  (69, 'group', 'K', 3, '2026-06-27T23:30:00Z', 12, 5),
  (70, 'group', 'K', 3, '2026-06-27T23:30:00Z', 36, 37),
  (71, 'group', 'J', 3, '2026-06-28T02:00:00Z', 25, 22),
  (72, 'group', 'J', 3, '2026-06-28T02:00:00Z', 42, 3);

-- Keep the identity counter ahead of the highest fixture id.
select setval(pg_get_serial_sequence('fixtures', 'id'),
  greatest(72, (select coalesce(max(id), 0) from fixtures)));

commit;
