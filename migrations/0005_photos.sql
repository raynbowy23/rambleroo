CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  bytes INTEGER NOT NULL CHECK(bytes > 0),
  type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX photos_user_id ON photos(user_id);
CREATE TABLE usage (month TEXT, metric TEXT, value INTEGER NOT NULL, PRIMARY KEY(month, metric));
INSERT INTO usage VALUES ('all', 'storedBytes', 0);
CREATE TRIGGER photos_reserve AFTER INSERT ON photos BEGIN
  UPDATE usage SET value = value + NEW.bytes WHERE month = 'all' AND metric = 'storedBytes';
END;
-- Only confirmed object deletions release storage; account cascades retain reservations for leftovers.
CREATE TRIGGER photos_release AFTER DELETE ON photos WHEN OLD.state = 'deleted' BEGIN
  UPDATE usage SET value = value - OLD.bytes WHERE month = 'all' AND metric = 'storedBytes';
END;
-- One photo operation per account at a time. A lock expires after two minutes, so an interrupted request never blocks a person's sync for good.
CREATE TABLE photo_locks (user_id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
