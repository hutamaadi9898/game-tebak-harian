CREATE TABLE IF NOT EXISTS streaks (
  client_id TEXT PRIMARY KEY,
  last_date TEXT NOT NULL,
  streak INTEGER NOT NULL,
  best_streak INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  client_id TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  email_hash TEXT PRIMARY KEY,
  email_hint TEXT NOT NULL,
  created_at TEXT NOT NULL
);
