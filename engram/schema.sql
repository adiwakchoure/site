PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS loops (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  body          TEXT DEFAULT '',

  state         TEXT NOT NULL DEFAULT 'open'
                  CHECK(state IN ('open', 'closed')),
  closed_reason TEXT
                  CHECK(closed_reason IN ('done', 'dropped', 'delegated', 'irrelevant')),

  energy        TEXT NOT NULL DEFAULT 'active'
                  CHECK(energy IN ('active', 'waiting', 'someday')),
  priority      TEXT NOT NULL DEFAULT 'P1'
                  CHECK(priority IN ('P0', 'P1', 'P2')),
  deadline      TEXT,

  project_id    TEXT REFERENCES projects(id),
  parent_id     TEXT REFERENCES loops(id),
  tags          TEXT DEFAULT '',

  created_at    TEXT NOT NULL,
  closed_at     TEXT,
  archived_at   TEXT,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id            TEXT PRIMARY KEY,
  loop_id       TEXT REFERENCES loops(id) ON DELETE CASCADE,

  kind          TEXT NOT NULL
                  CHECK(kind IN (
                    'created', 'closed', 'reopened', 'updated', 'noted'
                  )),

  body          TEXT,
  meta          TEXT,
  sequence      INTEGER NOT NULL DEFAULT 1,

  dump_id       TEXT REFERENCES dumps(id),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loop_notes (
  id            TEXT PRIMARY KEY,
  loop_id       TEXT NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  rel           TEXT DEFAULT '',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loop_person (
  loop_id       TEXT NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
  person_id     TEXT NOT NULL REFERENCES people(id),
  role          TEXT DEFAULT 'involved'
                  CHECK(role IN ('involved', 'waiting_on', 'delegated_to')),
  PRIMARY KEY (loop_id, person_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  color         TEXT DEFAULT '#a0714a',
  emoji         TEXT,
  archived      INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dumps (
  id            TEXT PRIMARY KEY,
  raw           TEXT NOT NULL,
  transcript    TEXT,
  source        TEXT NOT NULL DEFAULT 'text'
                  CHECK(source IN ('text', 'voice')),
  processed     INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suggestions (
  id            TEXT PRIMARY KEY,
  dump_id       TEXT REFERENCES dumps(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  payload       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending', 'accepted', 'dismissed')),
  created_at    TEXT NOT NULL,
  resolved_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_loops_active ON loops(state, energy) WHERE state = 'open';
CREATE INDEX IF NOT EXISTS idx_loops_deadline ON loops(deadline) WHERE deadline IS NOT NULL AND state = 'open';
CREATE INDEX IF NOT EXISTS idx_loops_project ON loops(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loops_parent ON loops(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_loop ON events(loop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind, created_at);
CREATE INDEX IF NOT EXISTS idx_events_sequence ON events(loop_id, sequence);
CREATE INDEX IF NOT EXISTS idx_loop_notes_loop ON loop_notes(loop_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_loop_person ON loop_person(person_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_dump ON suggestions(dump_id, status, created_at);
