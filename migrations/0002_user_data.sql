CREATE TABLE user_data (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('passport', 'trip', 'garage', 'postcards')),
  json TEXT NOT NULL CHECK(length(CAST(json AS BLOB)) <= 262144 AND json_valid(json)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, kind)
);
