-- migrations/0012_user_handle.sql
ALTER TABLE users ADD COLUMN handle TEXT;
CREATE UNIQUE INDEX idx_users_handle ON users(handle);
