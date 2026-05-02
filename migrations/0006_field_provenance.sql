CREATE TABLE field_provenance (
  museum_id   TEXT NOT NULL,
  field_path  TEXT NOT NULL,
  source_url  TEXT,
  authority   TEXT,
  recorded_at INTEGER NOT NULL,
  PRIMARY KEY (museum_id, field_path),
  FOREIGN KEY (museum_id) REFERENCES museums(id) ON DELETE CASCADE
);
CREATE INDEX idx_field_provenance_museum ON field_provenance(museum_id);
CREATE INDEX idx_field_provenance_authority ON field_provenance(authority);
