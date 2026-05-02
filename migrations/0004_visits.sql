CREATE TABLE visits (
  user_id TEXT NOT NULL DEFAULT 'me',
  museum_id TEXT NOT NULL,
  visited_at INTEGER NOT NULL,
  note TEXT,
  PRIMARY KEY(user_id, museum_id)
);

CREATE INDEX idx_visits_user ON visits(user_id, visited_at DESC);
