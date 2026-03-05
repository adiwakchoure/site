DELETE FROM loop_notes;
DELETE FROM events;
DELETE FROM suggestions;
DELETE FROM dumps;
DELETE FROM tags;
DELETE FROM tag_types;
DELETE FROM loops;

INSERT INTO loops (id, owner_id, title, content, opened_at, closed_at, updated_at) VALUES
  ('loop_001', 'demo', 'Launch homepage refresh', 'Coordinate design, copy, and QA signoff before launch.', '2026-03-04T09:00:00Z', NULL, '2026-03-05T10:20:00Z'),
  ('loop_002', 'demo', 'Finalize recruiting sprint plan', 'Prepare interview panel and timeline for backend role.', '2026-03-04T11:30:00Z', NULL, '2026-03-05T09:35:00Z');

INSERT INTO tag_types (id, owner_id, slug, name, value_kind, multi, system, created_at) VALUES
  ('tt_deadline', 'demo', 'deadline', 'Deadline', 'date', 0, 1, '2026-03-04T08:00:00Z'),
  ('tt_person', 'demo', 'person', 'Person', 'text', 1, 1, '2026-03-04T08:00:00Z'),
  ('tt_priority', 'demo', 'priority', 'Priority', 'text', 0, 1, '2026-03-04T08:00:00Z'),
  ('tt_project', 'demo', 'project', 'Project', 'text', 0, 1, '2026-03-04T08:00:00Z');

INSERT INTO tags (id, owner_id, loop_id, tag_type_id, value_text, value_number, value_date, value_json, created_at, updated_at) VALUES
  ('tag_001', 'demo', 'loop_001', 'tt_priority', 'P0', NULL, NULL, NULL, '2026-03-04T09:00:00Z', '2026-03-04T09:00:00Z'),
  ('tag_002', 'demo', 'loop_001', 'tt_deadline', NULL, NULL, '2026-03-12', NULL, '2026-03-04T09:00:00Z', '2026-03-04T09:00:00Z'),
  ('tag_003', 'demo', 'loop_001', 'tt_project', 'Website Revamp', NULL, NULL, NULL, '2026-03-04T09:00:00Z', '2026-03-04T09:00:00Z'),
  ('tag_004', 'demo', 'loop_001', 'tt_person', 'Avery Kim', NULL, NULL, NULL, '2026-03-04T09:00:00Z', '2026-03-04T09:00:00Z'),
  ('tag_005', 'demo', 'loop_001', 'tt_person', 'Noah Patel', NULL, NULL, NULL, '2026-03-04T09:01:00Z', '2026-03-04T09:01:00Z'),
  ('tag_006', 'demo', 'loop_002', 'tt_priority', 'P1', NULL, NULL, NULL, '2026-03-04T11:30:00Z', '2026-03-04T11:30:00Z'),
  ('tag_007', 'demo', 'loop_002', 'tt_deadline', NULL, NULL, '2026-03-18', NULL, '2026-03-04T11:30:00Z', '2026-03-04T11:30:00Z'),
  ('tag_008', 'demo', 'loop_002', 'tt_project', 'Hiring Q2', NULL, NULL, NULL, '2026-03-04T11:30:00Z', '2026-03-04T11:30:00Z'),
  ('tag_009', 'demo', 'loop_002', 'tt_person', 'Maya Singh', NULL, NULL, NULL, '2026-03-04T11:30:00Z', '2026-03-04T11:30:00Z');

INSERT INTO events (id, owner_id, loop_id, kind, body, meta, sequence, dump_id, created_at) VALUES
  ('evt_001', 'demo', 'loop_001', 'created', NULL, NULL, 1, NULL, '2026-03-04T09:00:00Z'),
  ('evt_002', 'demo', 'loop_001', 'noted', 'Draft hero copy pending final review.', NULL, 2, NULL, '2026-03-05T10:20:00Z'),
  ('evt_003', 'demo', 'loop_002', 'created', NULL, NULL, 1, NULL, '2026-03-04T11:30:00Z'),
  ('evt_004', 'demo', 'loop_002', 'noted', 'Need interview rubric aligned by Friday.', NULL, 2, NULL, '2026-03-05T09:35:00Z');

INSERT INTO loop_notes (id, owner_id, loop_id, body, created_at, updated_at) VALUES
  ('ln_001', 'demo', 'loop_001', 'Sync with design after homepage analytics baseline is captured.', '2026-03-05T10:10:00Z', '2026-03-05T10:10:00Z'),
  ('ln_002', 'demo', 'loop_002', 'Collect interviewer availability in one shared sheet.', '2026-03-05T09:30:00Z', '2026-03-05T09:30:00Z');
