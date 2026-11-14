-- 寄 · 手卷分享 (docs/superpowers/specs/寄.md §7). Additive only.
CREATE TABLE IF NOT EXISTS share_scrolls (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  user_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS share_guan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scroll_id TEXT NOT NULL REFERENCES share_scrolls(id) ON DELETE CASCADE,
  name TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_share_guan_scroll ON share_guan(scroll_id, created_at);
