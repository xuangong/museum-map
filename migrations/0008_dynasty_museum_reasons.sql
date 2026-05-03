-- Auto-generated reasons explaining why a museum is relevant to a dynasty.
CREATE TABLE IF NOT EXISTS dynasty_museum_reasons (
  dynasty_id    TEXT NOT NULL,
  museum_id     TEXT NOT NULL,
  reason        TEXT NOT NULL,
  evidence_json TEXT,
  generated_at  INTEGER NOT NULL,
  PRIMARY KEY (dynasty_id, museum_id),
  FOREIGN KEY (dynasty_id) REFERENCES dynasties(id) ON DELETE CASCADE,
  FOREIGN KEY (museum_id)  REFERENCES museums(id)   ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dmr_dynasty ON dynasty_museum_reasons(dynasty_id);
CREATE INDEX IF NOT EXISTS idx_dmr_museum  ON dynasty_museum_reasons(museum_id);
