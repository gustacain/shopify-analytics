const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'analytics.db'));

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA synchronous = NORMAL`);
db.exec(`PRAGMA foreign_keys = ON`);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id       TEXT    NOT NULL,
    event_type       TEXT    NOT NULL,
    page_url         TEXT,
    x                REAL,
    y                REAL,
    viewport_width   INTEGER,
    viewport_height  INTEGER,
    element          TEXT,
    scroll_percent   INTEGER,
    time_on_page     INTEGER,
    device_type      TEXT    DEFAULT 'desktop',
    screen_width     INTEGER,
    screen_height    INTEGER,
    user_agent       TEXT,
    metadata         TEXT,
    created_at       TEXT    DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
  CREATE INDEX IF NOT EXISTS idx_events_page    ON events(page_url);
  CREATE INDEX IF NOT EXISTS idx_events_type    ON events(event_type);
  CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
  CREATE INDEX IF NOT EXISTS idx_events_device  ON events(device_type);

  CREATE TABLE IF NOT EXISTS webhook_config (
    id             INTEGER PRIMARY KEY,
    n8n_url        TEXT,
    cart_threshold REAL    DEFAULT 0.70,
    last_cart_alert TEXT,
    updated_at     TEXT    DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO webhook_config (id, n8n_url, cart_threshold)
  VALUES (1, NULL, 0.70);
`);

// Thin wrapper to keep the same interface as better-sqlite3 in the routes.
// node:sqlite uses positional OR named params; named params are passed as a plain
// object (keys without leading sigil, e.g. { session_id: 'x' } for @session_id).
module.exports = db;
