-- Cache for AI-generated dynasty-scoped reviews of a user's footprint.
CREATE TABLE IF NOT EXISTS dynasty_review_cache (
  user_id      TEXT NOT NULL DEFAULT 'me',
  dynasty_id   TEXT NOT NULL,
  summary      TEXT NOT NULL,
  visit_count  INTEGER NOT NULL,
  generated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, dynasty_id),
  FOREIGN KEY (dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_drc_dynasty ON dynasty_review_cache(dynasty_id);
