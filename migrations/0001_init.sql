PRAGMA foreign_keys = ON;

CREATE TABLE museums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  location TEXT,
  level TEXT,
  core_period TEXT,
  specialty TEXT,
  dynasty_coverage TEXT,
  timeline TEXT
);

CREATE TABLE museum_treasures (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE museum_halls (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE museum_artifacts (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  period TEXT,
  description TEXT,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE museum_dynasty_connections (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  dynasty TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE museum_sources (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE dynasties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  period TEXT,
  center_lat REAL,
  center_lng REAL,
  overview TEXT,
  order_index INTEGER NOT NULL
);

CREATE TABLE dynasty_culture (
  dynasty_id TEXT NOT NULL REFERENCES dynasties(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY(dynasty_id, order_index)
);

CREATE TABLE dynasty_events (
  dynasty_id TEXT NOT NULL REFERENCES dynasties(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  date TEXT NOT NULL,
  event TEXT NOT NULL,
  lat REAL,
  lng REAL,
  PRIMARY KEY(dynasty_id, order_index)
);

CREATE TABLE dynasty_recommended_museums (
  dynasty_id TEXT NOT NULL REFERENCES dynasties(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  museum_id TEXT REFERENCES museums(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  location TEXT,
  reason TEXT,
  PRIMARY KEY(dynasty_id, order_index)
);

CREATE INDEX idx_museums_coords ON museums(lat, lng);
CREATE INDEX idx_dynasty_events_dynasty ON dynasty_events(dynasty_id);
CREATE INDEX idx_dynasty_recommended_dynasty ON dynasty_recommended_museums(dynasty_id);
