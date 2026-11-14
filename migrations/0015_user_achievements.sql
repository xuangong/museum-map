-- Unlocked achievements are kept, never recomputed away (docs/superpowers/specs/打卡成就.md §3).
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  reached_at INTEGER NOT NULL,
  completed_at INTEGER,
  PRIMARY KEY (user_id, achievement_id)
);
