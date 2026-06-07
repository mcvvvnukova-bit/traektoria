CREATE TABLE IF NOT EXISTS bot_sessions (
  platform TEXT NOT NULL DEFAULT 'telegram',
  chat_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bot_sessions
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'telegram';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'bot_sessions'
      AND column_name = 'chat_id'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE bot_sessions
      ALTER COLUMN chat_id TYPE TEXT USING chat_id::TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'bot_sessions'::regclass
      AND conname = 'bot_sessions_pkey'
  ) THEN
    ALTER TABLE bot_sessions DROP CONSTRAINT bot_sessions_pkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'bot_sessions'::regclass
      AND conname = 'bot_sessions_platform_chat_id_pkey'
  ) THEN
    ALTER TABLE bot_sessions
      ADD CONSTRAINT bot_sessions_platform_chat_id_pkey PRIMARY KEY (platform, chat_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS bot_runtime_state (
  state_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendation_history (
  id BIGSERIAL PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'telegram',
  chat_id TEXT NOT NULL,
  source TEXT,
  confidence TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE recommendation_history
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'telegram';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'recommendation_history'
      AND column_name = 'chat_id'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE recommendation_history
      ALTER COLUMN chat_id TYPE TEXT USING chat_id::TEXT;
  END IF;
END $$;

DROP INDEX IF EXISTS recommendation_history_chat_id_idx;

CREATE INDEX IF NOT EXISTS recommendation_history_platform_chat_id_idx
  ON recommendation_history (platform, chat_id, created_at DESC);
