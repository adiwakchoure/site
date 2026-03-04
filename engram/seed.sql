DELETE FROM loop_notes;
DELETE FROM events;
DELETE FROM suggestions;
DELETE FROM dumps;
DELETE FROM tags;
DELETE FROM tag_types;
DELETE FROM loops;

INSERT INTO loops (id, owner_id, title, content, opened_at, closed_at, updated_at) VALUES
  ('loop_001', 'demo', 'Q2 launch readiness', 'Umbrella loop for launch-critical work.', '2026-03-01T09:00:00Z', NULL, '2026-03-04T10:30:00Z'),
  ('loop_002', 'demo', 'Ship onboarding flow v2', 'Polish first-run experience and metrics.', '2026-03-02T11:00:00Z', NULL, '2026-03-04T11:20:00Z'),
  ('loop_003', 'demo', 'Get legal approval for pricing copy', NULL, '2026-03-02T15:10:00Z', NULL, '2026-03-04T09:15:00Z'),
  ('loop_004', 'demo', 'Plan iOS PWA viewport QA matrix', 'Safari bars, standalone, rotation, notch devices.', '2026-03-03T08:45:00Z', NULL, '2026-03-04T08:50:00Z'),
  ('loop_005', 'demo', 'Investigate speech model options', 'Compare cost, latency, and transcript quality.', '2026-03-01T14:10:00Z', NULL, '2026-03-03T18:00:00Z'),
  ('loop_006', 'demo', 'Migrate old project relations', NULL, '2026-02-27T13:00:00Z', '2026-03-03T16:20:00Z', '2026-03-03T16:20:00Z'),
  ('loop_007', 'demo', 'Conference sponsorship follow-up', NULL, '2026-02-25T12:00:00Z', '2026-03-01T12:30:00Z', '2026-03-01T12:30:00Z'),
  ('loop_008', 'demo', 'Clean up stale experiments', 'Archive old prototype branches and notes.', '2026-03-01T18:00:00Z', NULL, '2026-03-04T07:40:00Z');

INSERT INTO tag_types (id, owner_id, slug, name, value_kind, multi, system, created_at) VALUES
  ('tt_state', 'demo', 'state', 'State', 'text', 0, 1, '2026-02-10T09:00:00Z'),
  ('tt_deadline', 'demo', 'deadline', 'Deadline', 'date', 0, 1, '2026-02-10T09:00:00Z'),
  ('tt_priority', 'demo', 'priority', 'Priority', 'text', 0, 1, '2026-02-10T09:00:00Z'),
  ('tt_energy', 'demo', 'energy', 'Energy', 'text', 0, 1, '2026-02-10T09:00:00Z'),
  ('tt_project', 'demo', 'project', 'Project', 'text', 0, 1, '2026-02-10T09:00:00Z'),
  ('tt_person', 'demo', 'person', 'Person', 'text', 1, 1, '2026-02-10T09:00:00Z'),
  ('tt_parent', 'demo', 'parent', 'Parent', 'text', 0, 1, '2026-02-10T09:00:00Z'),
  ('tt_closed_reason', 'demo', 'closed_reason', 'Closed reason', 'text', 0, 1, '2026-02-10T09:00:00Z'),
  ('tt_area', 'demo', 'area', 'Area', 'text', 0, 0, '2026-02-10T09:00:00Z'),
  ('tt_effort', 'demo', 'effort', 'Effort', 'number', 0, 0, '2026-02-10T09:00:00Z'),
  ('tt_context', 'demo', 'context', 'Context', 'json', 0, 0, '2026-02-10T09:00:00Z'),
  ('tt_channel', 'demo', 'channel', 'Channel', 'text', 1, 0, '2026-02-10T09:00:00Z');

INSERT INTO tags (id, owner_id, loop_id, tag_type_id, value_text, value_number, value_date, value_json, created_at, updated_at) VALUES
  ('tag_001', 'demo', 'loop_001', 'tt_state', 'open', NULL, NULL, NULL, '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'),
  ('tag_002', 'demo', 'loop_001', 'tt_priority', 'P0', NULL, NULL, NULL, '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'),
  ('tag_003', 'demo', 'loop_001', 'tt_energy', 'active', NULL, NULL, NULL, '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'),
  ('tag_004', 'demo', 'loop_001', 'tt_project', 'Launch', NULL, NULL, NULL, '2026-03-01T09:00:00Z', '2026-03-01T09:00:00Z'),
  ('tag_005', 'demo', 'loop_002', 'tt_state', 'open', NULL, NULL, NULL, '2026-03-02T11:00:00Z', '2026-03-02T11:00:00Z'),
  ('tag_006', 'demo', 'loop_002', 'tt_parent', 'loop_001', NULL, NULL, NULL, '2026-03-02T11:00:00Z', '2026-03-02T11:00:00Z'),
  ('tag_007', 'demo', 'loop_002', 'tt_deadline', NULL, NULL, '2026-03-08', NULL, '2026-03-02T11:00:00Z', '2026-03-02T11:00:00Z'),
  ('tag_008', 'demo', 'loop_002', 'tt_person', 'Sarah Chen', NULL, NULL, NULL, '2026-03-02T11:00:00Z', '2026-03-02T11:00:00Z'),
  ('tag_009', 'demo', 'loop_002', 'tt_person', 'Mike Owens', NULL, NULL, NULL, '2026-03-02T11:01:00Z', '2026-03-02T11:01:00Z'),
  ('tag_010', 'demo', 'loop_002', 'tt_channel', 'mobile', NULL, NULL, NULL, '2026-03-02T11:02:00Z', '2026-03-02T11:02:00Z'),
  ('tag_011', 'demo', 'loop_002', 'tt_channel', 'growth', NULL, NULL, NULL, '2026-03-02T11:03:00Z', '2026-03-02T11:03:00Z'),
  ('tag_012', 'demo', 'loop_003', 'tt_state', 'open', NULL, NULL, NULL, '2026-03-02T15:10:00Z', '2026-03-02T15:10:00Z'),
  ('tag_013', 'demo', 'loop_003', 'tt_priority', 'P1', NULL, NULL, NULL, '2026-03-02T15:10:00Z', '2026-03-02T15:10:00Z'),
  ('tag_014', 'demo', 'loop_003', 'tt_energy', 'waiting', NULL, NULL, NULL, '2026-03-02T15:10:00Z', '2026-03-02T15:10:00Z'),
  ('tag_015', 'demo', 'loop_003', 'tt_person', 'Priya Sharma', NULL, NULL, NULL, '2026-03-02T15:10:00Z', '2026-03-02T15:10:00Z'),
  ('tag_016', 'demo', 'loop_003', 'tt_deadline', NULL, NULL, '2026-03-06', NULL, '2026-03-02T15:10:00Z', '2026-03-02T15:10:00Z'),
  ('tag_017', 'demo', 'loop_004', 'tt_state', 'open', NULL, NULL, NULL, '2026-03-03T08:45:00Z', '2026-03-03T08:45:00Z'),
  ('tag_018', 'demo', 'loop_004', 'tt_project', 'Launch', NULL, NULL, NULL, '2026-03-03T08:45:00Z', '2026-03-03T08:45:00Z'),
  ('tag_019', 'demo', 'loop_004', 'tt_area', 'QA', NULL, NULL, NULL, '2026-03-03T08:45:00Z', '2026-03-03T08:45:00Z'),
  ('tag_020', 'demo', 'loop_004', 'tt_effort', NULL, 5, NULL, NULL, '2026-03-03T08:45:00Z', '2026-03-03T08:45:00Z'),
  ('tag_021', 'demo', 'loop_004', 'tt_context', NULL, NULL, NULL, '{"devices":["iPhone13","iPhone15Pro"],"mode":"safari+pwa"}', '2026-03-03T08:45:00Z', '2026-03-03T08:45:00Z'),
  ('tag_022', 'demo', 'loop_005', 'tt_state', 'open', NULL, NULL, NULL, '2026-03-01T14:10:00Z', '2026-03-01T14:10:00Z'),
  ('tag_023', 'demo', 'loop_005', 'tt_energy', 'someday', NULL, NULL, NULL, '2026-03-01T14:10:00Z', '2026-03-01T14:10:00Z'),
  ('tag_024', 'demo', 'loop_005', 'tt_priority', 'P2', NULL, NULL, NULL, '2026-03-01T14:10:00Z', '2026-03-01T14:10:00Z'),
  ('tag_025', 'demo', 'loop_005', 'tt_area', 'R&D', NULL, NULL, NULL, '2026-03-01T14:10:00Z', '2026-03-01T14:10:00Z'),
  ('tag_026', 'demo', 'loop_005', 'tt_effort', NULL, 3, NULL, NULL, '2026-03-01T14:10:00Z', '2026-03-01T14:10:00Z'),
  ('tag_027', 'demo', 'loop_006', 'tt_state', 'closed', NULL, NULL, NULL, '2026-02-27T13:00:00Z', '2026-03-03T16:20:00Z'),
  ('tag_028', 'demo', 'loop_006', 'tt_closed_reason', 'done', NULL, NULL, NULL, '2026-03-03T16:20:00Z', '2026-03-03T16:20:00Z'),
  ('tag_029', 'demo', 'loop_007', 'tt_state', 'closed', NULL, NULL, NULL, '2026-02-25T12:00:00Z', '2026-03-01T12:30:00Z'),
  ('tag_030', 'demo', 'loop_007', 'tt_closed_reason', 'dropped', NULL, NULL, NULL, '2026-03-01T12:30:00Z', '2026-03-01T12:30:00Z'),
  ('tag_031', 'demo', 'loop_007', 'tt_person', 'Alex Rivera', NULL, NULL, NULL, '2026-02-25T12:00:00Z', '2026-02-25T12:00:00Z'),
  ('tag_032', 'demo', 'loop_008', 'tt_state', 'open', NULL, NULL, NULL, '2026-03-01T18:00:00Z', '2026-03-01T18:00:00Z'),
  ('tag_033', 'demo', 'loop_008', 'tt_priority', 'P2', NULL, NULL, NULL, '2026-03-01T18:00:00Z', '2026-03-01T18:00:00Z'),
  ('tag_034', 'demo', 'loop_008', 'tt_area', 'Infra', NULL, NULL, NULL, '2026-03-01T18:00:00Z', '2026-03-01T18:00:00Z');

INSERT INTO events (id, owner_id, loop_id, kind, body, meta, sequence, dump_id, created_at) VALUES
  ('evt_001', 'demo', 'loop_001', 'created', NULL, NULL, 1, NULL, '2026-03-01T09:00:00Z'),
  ('evt_002', 'demo', 'loop_001', 'noted', 'Split launch readiness into concrete child loops.', NULL, 2, NULL, '2026-03-03T09:00:00Z'),
  ('evt_003', 'demo', 'loop_002', 'created', NULL, NULL, 1, NULL, '2026-03-02T11:00:00Z'),
  ('evt_004', 'demo', 'loop_002', 'updated', 'deadline -> 2026-03-08', NULL, 2, NULL, '2026-03-03T10:20:00Z'),
  ('evt_005', 'demo', 'loop_003', 'created', NULL, NULL, 1, NULL, '2026-03-02T15:10:00Z'),
  ('evt_006', 'demo', 'loop_004', 'created', NULL, NULL, 1, NULL, '2026-03-03T08:45:00Z'),
  ('evt_007', 'demo', 'loop_005', 'created', NULL, NULL, 1, NULL, '2026-03-01T14:10:00Z'),
  ('evt_008', 'demo', 'loop_006', 'closed', 'Migration complete and verified.', NULL, 2, NULL, '2026-03-03T16:20:00Z'),
  ('evt_009', 'demo', 'loop_007', 'closed', 'Sponsorship no longer relevant.', NULL, 2, NULL, '2026-03-01T12:30:00Z');

INSERT INTO loop_notes (id, owner_id, loop_id, body, created_at, updated_at) VALUES
  ('ln_001', 'demo', 'loop_002', 'Using phased rollout with feature flags.', '2026-03-03T12:15:00Z', '2026-03-03T12:15:00Z'),
  ('ln_002', 'demo', 'loop_003', 'Waiting on legal redlines from Priya.', '2026-03-04T09:15:00Z', '2026-03-04T09:15:00Z'),
  ('ln_003', 'demo', 'loop_004', 'Need to verify bottom-sheet behavior with Safari bars.', '2026-03-04T08:52:00Z', '2026-03-04T08:52:00Z');
