-- Wipe everything
DELETE FROM loop_person;
DELETE FROM loop_notes;
DELETE FROM events;
DELETE FROM suggestions;
DELETE FROM dumps;
DELETE FROM loops;
DELETE FROM people;
DELETE FROM projects;

-- ============ PEOPLE ============
INSERT INTO people (id, name, rel, created_at) VALUES
  ('per_001', 'Sarah Chen',    'design lead at Canopy',   '2026-02-10T09:00:00Z'),
  ('per_002', 'Mike Owens',    'co-founder',              '2026-02-10T09:00:00Z'),
  ('per_003', 'Priya Sharma',  'client, Aurum project',   '2026-02-14T11:00:00Z');

-- ============ PROJECTS ============
INSERT INTO projects (id, name, color, emoji, archived, created_at) VALUES
  ('proj_001', 'Aurum',      '#a0714a', NULL, 0, '2026-02-10T09:00:00Z'),
  ('proj_002', 'Site Relaunch', '#6e63a0', NULL, 0, '2026-02-12T10:00:00Z');

-- ============ LOOPS ============

-- Sarah loops
INSERT INTO loops (id, title, body, state, closed_reason, energy, priority, deadline, project_id, parent_id, tags, created_at, closed_at, archived_at, updated_at) VALUES
  ('loop_001', 'Review Sarah''s brand explorations',       '', 'open', NULL, 'active',  'P1', '2026-03-05', 'proj_001', NULL, '', '2026-02-20T10:00:00Z', NULL, NULL, '2026-02-27T14:00:00Z'),
  ('loop_002', 'Get Sarah''s feedback on pricing page',    '', 'open', NULL, 'waiting', 'P1', '2026-03-07', 'proj_002', NULL, '', '2026-02-22T11:00:00Z', NULL, NULL, '2026-02-26T09:00:00Z');

-- Mike loops
INSERT INTO loops (id, title, body, state, closed_reason, energy, priority, deadline, project_id, parent_id, tags, created_at, closed_at, archived_at, updated_at) VALUES
  ('loop_003', 'Finalize investor deck with Mike',         '', 'open', NULL, 'active',  'P0', '2026-03-03', NULL,       NULL, '', '2026-02-18T08:00:00Z', NULL, NULL, '2026-02-28T16:00:00Z'),
  ('loop_004', 'Mike to set up analytics dashboard',       '', 'open', NULL, 'waiting', 'P2', NULL,         'proj_002', NULL, '', '2026-02-24T14:00:00Z', NULL, NULL, '2026-02-24T14:00:00Z'),
  ('loop_005', 'Sync with Mike on hiring plan',            '', 'open', NULL, 'active',  'P1', '2026-03-10', NULL,       NULL, '', '2026-02-15T09:00:00Z', NULL, NULL, '2026-02-25T11:00:00Z');

-- Priya loops
INSERT INTO loops (id, title, body, state, closed_reason, energy, priority, deadline, project_id, parent_id, tags, created_at, closed_at, archived_at, updated_at) VALUES
  ('loop_006', 'Send Priya the revised scope document',    '', 'open', NULL, 'active',  'P0', '2026-03-02', 'proj_001', NULL, '', '2026-02-25T10:00:00Z', NULL, NULL, '2026-02-28T12:00:00Z'),
  ('loop_007', 'Schedule Priya walkthrough for milestone 2','', 'open', NULL, 'someday', 'P2', NULL,         'proj_001', NULL, '', '2026-02-26T15:00:00Z', NULL, NULL, '2026-02-26T15:00:00Z');

-- A couple of closed ones for context
INSERT INTO loops (id, title, body, state, closed_reason, energy, priority, deadline, project_id, parent_id, tags, created_at, closed_at, archived_at, updated_at) VALUES
  ('loop_008', 'Set up Aurum Figma workspace',             '', 'closed', 'done',    'active', 'P1', NULL,         'proj_001', NULL, '', '2026-02-11T09:00:00Z', '2026-02-19T17:00:00Z', NULL, '2026-02-19T17:00:00Z'),
  ('loop_009', 'Book conference travel',                   '', 'closed', 'dropped', 'active', 'P2', '2026-02-20', NULL,       NULL, '', '2026-02-13T10:00:00Z', '2026-02-18T08:00:00Z', NULL, '2026-02-18T08:00:00Z');

-- ============ LOOP ↔ PERSON ============
INSERT INTO loop_person (loop_id, person_id, role) VALUES
  ('loop_001', 'per_001', 'involved'),
  ('loop_002', 'per_001', 'waiting_on'),
  ('loop_003', 'per_002', 'involved'),
  ('loop_004', 'per_002', 'delegated_to'),
  ('loop_005', 'per_002', 'involved'),
  ('loop_006', 'per_003', 'waiting_on'),
  ('loop_007', 'per_003', 'involved');

-- ============ EVENTS (timeline) ============
INSERT INTO events (id, loop_id, kind, body, meta, sequence, dump_id, created_at) VALUES
  ('evt_001', 'loop_001', 'created', NULL, NULL, 1, NULL, '2026-02-20T10:00:00Z'),
  ('evt_002', 'loop_001', 'noted',   'Sarah shared 3 directions — earthy palette looks strongest', NULL, 2, NULL, '2026-02-24T15:00:00Z'),
  ('evt_003', 'loop_001', 'noted',   'Narrowed down to 2 options, waiting on final assets',        NULL, 3, NULL, '2026-02-27T14:00:00Z'),

  ('evt_004', 'loop_002', 'created', NULL, NULL, 1, NULL, '2026-02-22T11:00:00Z'),
  ('evt_005', 'loop_002', 'noted',   'Sent pricing page mockup to Sarah for review', NULL, 2, NULL, '2026-02-26T09:00:00Z'),

  ('evt_006', 'loop_003', 'created', NULL, NULL, 1, NULL, '2026-02-18T08:00:00Z'),
  ('evt_007', 'loop_003', 'noted',   'First draft done — 18 slides, needs financials section', NULL, 2, NULL, '2026-02-23T10:00:00Z'),
  ('evt_008', 'loop_003', 'noted',   'Mike added revenue projections, reviewing tonight',       NULL, 3, NULL, '2026-02-28T16:00:00Z'),

  ('evt_009', 'loop_005', 'created', NULL, NULL, 1, NULL, '2026-02-15T09:00:00Z'),
  ('evt_010', 'loop_005', 'noted',   'Agreed to hire 2 engineers, need to post roles', NULL, 2, NULL, '2026-02-25T11:00:00Z'),

  ('evt_011', 'loop_006', 'created', NULL, NULL, 1, NULL, '2026-02-25T10:00:00Z'),
  ('evt_012', 'loop_006', 'noted',   'Scope mostly done, need to add payment terms section', NULL, 2, NULL, '2026-02-28T12:00:00Z'),

  ('evt_013', 'loop_008', 'created', NULL, NULL, 1, NULL, '2026-02-11T09:00:00Z'),
  ('evt_014', 'loop_008', 'closed',  'Workspace set up, shared with team', NULL, 2, NULL, '2026-02-19T17:00:00Z'),

  ('evt_015', 'loop_009', 'created', NULL, NULL, 1, NULL, '2026-02-13T10:00:00Z'),
  ('evt_016', 'loop_009', 'closed',  'Conference cancelled', NULL, 2, NULL, '2026-02-18T08:00:00Z');

-- ============ LOOP NOTES ============
INSERT INTO loop_notes (id, loop_id, body, created_at, updated_at) VALUES
  ('ln_001', 'loop_001', 'Sarah shared 3 directions — earthy palette looks strongest',   '2026-02-24T15:00:00Z', '2026-02-24T15:00:00Z'),
  ('ln_002', 'loop_001', 'Narrowed down to 2 options, waiting on final assets',          '2026-02-27T14:00:00Z', '2026-02-27T14:00:00Z'),
  ('ln_003', 'loop_003', 'First draft done — 18 slides, needs financials section',       '2026-02-23T10:00:00Z', '2026-02-23T10:00:00Z'),
  ('ln_004', 'loop_003', 'Mike added revenue projections, reviewing tonight',             '2026-02-28T16:00:00Z', '2026-02-28T16:00:00Z'),
  ('ln_005', 'loop_005', 'Agreed to hire 2 engineers, need to post roles',               '2026-02-25T11:00:00Z', '2026-02-25T11:00:00Z'),
  ('ln_006', 'loop_006', 'Scope mostly done, need to add payment terms section',         '2026-02-28T12:00:00Z', '2026-02-28T12:00:00Z'),
  ('ln_007', 'loop_002', 'Sent pricing page mockup to Sarah for review',                 '2026-02-26T09:00:00Z', '2026-02-26T09:00:00Z');
