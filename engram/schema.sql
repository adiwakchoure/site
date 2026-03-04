PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS loops (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT,
  opened_at     TEXT NOT NULL,
  closed_at     TEXT,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tag_types (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,
  value_kind    TEXT NOT NULL
                  CHECK(value_kind IN ('text', 'number', 'date', 'json')),
  multi         INTEGER NOT NULL DEFAULT 0,
  system        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  UNIQUE(owner_id, slug)
);

CREATE TABLE IF NOT EXISTS tags (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL,
  loop_id       TEXT NOT NULL REFERENCES loops(id) ON DELETE CASCADE,
  tag_type_id   TEXT NOT NULL REFERENCES tag_types(id) ON DELETE CASCADE,
  value_text    TEXT,
  value_number  REAL,
  value_date    TEXT,
  value_json    TEXT,
  created_at    TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_loops_owner_opened ON loops(owner_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_loops_owner_closed ON loops(owner_id, closed_at);
CREATE INDEX IF NOT EXISTS idx_tags_owner_loop_type ON tags(owner_id, loop_id, tag_type_id);
CREATE INDEX IF NOT EXISTS idx_tags_owner_type_date ON tags(owner_id, tag_type_id, value_date);
CREATE INDEX IF NOT EXISTS idx_tag_types_owner_slug ON tag_types(owner_id, slug);
CREATE INDEX IF NOT EXISTS idx_events_owner_loop_created ON events(owner_id, loop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_owner_kind_created ON events(owner_id, kind, created_at);
CREATE INDEX IF NOT EXISTS idx_events_owner_loop_sequence ON events(owner_id, loop_id, sequence);
CREATE INDEX IF NOT EXISTS idx_loop_notes_owner_loop_updated ON loop_notes(owner_id, loop_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_dumps_owner_created ON dumps(owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_suggestions_owner_dump_status_created ON suggestions(owner_id, dump_id, status, created_at);
