CREATE TABLE museums_pending (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  notes TEXT
);

CREATE INDEX idx_museums_pending_status ON museums_pending(status, created_at);
