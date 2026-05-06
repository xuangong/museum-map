-- migrations/0014_plaza.sql
ALTER TABLE users ADD COLUMN show_on_plaza INTEGER NOT NULL DEFAULT 1;
CREATE INDEX idx_users_show_on_plaza ON users(show_on_plaza);
