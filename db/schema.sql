CREATE TABLE IF NOT EXISTS bot_sessions (
  platform TEXT NOT NULL DEFAULT 'telegram',
  chat_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bot_sessions
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'telegram';

ALTER TABLE bot_sessions
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

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
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE recommendation_history
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'telegram';

ALTER TABLE recommendation_history
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

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

CREATE TABLE IF NOT EXISTS scenario1_criteria_recognition_log (
  id BIGSERIAL PRIMARY KEY,
  platform TEXT NOT NULL DEFAULT 'telegram',
  session_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  channel_id TEXT,
  channel_type TEXT,
  input_text TEXT NOT NULL,
  recognition_method TEXT NOT NULL,
  recognition_confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  criterion_01_municipality JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_02_organization_restriction JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_03_age JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_04_cost JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_05_completed_program_exclusion JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_06_education_form JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_07_schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_08_availability JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_09_direction JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_10_group_size JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_11_program_topics_available JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_12_exact_interest_topic JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_13_interest_level2_category JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_14_interest_level1_section JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_15_fallback_text_keywords JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_16_interest_without_thematic_match JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_17_completed_exact_topic_match JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_18_new_topic_same_level2 JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_19_new_topic_same_level1 JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_20_no_completed_topic_link JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_21_depth_signal JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_22_no_depth_signal_repeat JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_23_repeat_completed_level2 JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_24_new_level2_new_level1 JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_25_new_level2_same_level1 JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_26_any_classifier_topic JSONB NOT NULL DEFAULT '{}'::jsonb,
  criterion_27_new_interest_program_level JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scenario1_criteria_recognition_method_check
    CHECK (recognition_method IN ('LLM', 'regexp')),
  CONSTRAINT scenario1_criteria_recognition_confidence_check
    CHECK (recognition_confidence >= 0 AND recognition_confidence <= 1)
);

CREATE INDEX IF NOT EXISTS scenario1_criteria_recognition_session_idx
  ON scenario1_criteria_recognition_log (platform, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS scenario1_criteria_recognition_channel_idx
  ON scenario1_criteria_recognition_log (channel, created_at DESC);
