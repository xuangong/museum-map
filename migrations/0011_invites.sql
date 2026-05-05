-- migrations/0011_invites.sql
CREATE TABLE invites (
  code TEXT PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  used_at INTEGER,
  used_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  note TEXT
);
CREATE INDEX idx_invites_used ON invites(used_at);
