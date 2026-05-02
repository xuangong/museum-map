CREATE TABLE review_cache (
  user_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 0,
  with_chat_context INTEGER NOT NULL DEFAULT 0,
  generated_at INTEGER NOT NULL
);
