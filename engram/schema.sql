PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS loops (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
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
  owner_id      TEXT NOT NULL,
  loop_id       TEXT REFERENCES loops(id) ON DELETE CASCADE,

  kind          TEXT NOT NULL
                  CHECK(kind IN (
                    'created', 'closed', 'reopened', 'updated', 'noted', 'deleted'
                  )),

  body          TEXT,
  meta          TEXT,
  sequence      INTEGER NOT NULL DEFAULT 1,

  dump_id       TEXT REFERENCES dumps(id),
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loop_notes (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  loop_id       TEXT NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  name          TEXT NOT NULL,
  rel           TEXT DEFAULT '',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loop_person (
  owner_id      TEXT NOT NULL,
  loop_id       TEXT NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
  person_id     TEXT NOT NULL REFERENCES people(id),
  role          TEXT DEFAULT 'involved'
                  CHECK(role IN ('involved', 'waiting_on', 'delegated_to')),
  PRIMARY KEY (owner_id, loop_id, person_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  name          TEXT NOT NULL,
  color         TEXT DEFAULT '#a0714a',
  emoji         TEXT,
  archived      INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dumps (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  raw           TEXT NOT NULL,
  transcript    TEXT,
  source        TEXT NOT NULL DEFAULT 'text'
                  CHECK(source IN ('text', 'voice')),
  processed     INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suggestions (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  dump_id       TEXT REFERENCES dumps(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  payload       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending', 'accepted', 'dismissed')),
  created_at    TEXT NOT NULL,
  resolved_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_loops_owner_state_energy ON loops(owner_id, state, energy);
CREATE INDEX IF NOT EXISTS idx_loops_owner_deadline ON loops(owner_id, deadline) WHERE deadline IS NOT NULL AND state = 'open';
CREATE INDEX IF NOT EXISTS idx_loops_owner_project ON loops(owner_id, project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loops_owner_parent ON loops(owner_id, parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_owner_loop_created ON events(owner_id, loop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_owner_kind_created ON events(owner_id, kind, created_at);
CREATE INDEX IF NOT EXISTS idx_events_owner_loop_sequence ON events(owner_id, loop_id, sequence);
CREATE INDEX IF NOT EXISTS idx_loop_notes_owner_loop_updated ON loop_notes(owner_id, loop_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_loop_person_owner_person ON loop_person(owner_id, person_id);
CREATE INDEX IF NOT EXISTS idx_people_owner_name ON people(owner_id, name);
CREATE INDEX IF NOT EXISTS idx_projects_owner_name ON projects(owner_id, name);
CREATE INDEX IF NOT EXISTS idx_dumps_owner_created ON dumps(owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_suggestions_owner_dump_status_created ON suggestions(owner_id, dump_id, status, created_at);
