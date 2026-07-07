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
  criterion_01_municipality_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_01_municipality_value TEXT,
  criterion_01_municipality_confidence NUMERIC(4,3),
  criterion_02_organization_restriction_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_02_organization_restriction_value TEXT,
  criterion_02_organization_restriction_confidence NUMERIC(4,3),
  criterion_03_age_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_03_age_bucket TEXT,
  criterion_03_age_years INTEGER,
  criterion_03_age_text TEXT,
  criterion_03_age_confidence NUMERIC(4,3),
  criterion_04_cost_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_04_cost_value TEXT,
  criterion_04_cost_confidence NUMERIC(4,3),
  criterion_05_completed_program_exclusion_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_05_completed_program_exclusion_value TEXT,
  criterion_05_completed_program_exclusion_confidence NUMERIC(4,3),
  criterion_06_education_form_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_06_education_form_format TEXT,
  criterion_06_education_form_format_label TEXT,
  criterion_06_education_form_confidence NUMERIC(4,3),
  criterion_07_schedule_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_07_schedule_text TEXT,
  criterion_07_schedule_values TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  criterion_07_schedule_confidence NUMERIC(4,3),
  criterion_08_availability_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_08_availability_value TEXT,
  criterion_08_availability_confidence NUMERIC(4,3),
  criterion_09_direction_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_09_direction_value TEXT,
  criterion_09_direction_label TEXT,
  criterion_09_direction_confidence NUMERIC(4,3),
  criterion_10_group_size_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_10_group_size_value TEXT,
  criterion_10_group_size_confidence NUMERIC(4,3),
  criterion_11_program_topics_available_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_11_program_topics_available_value TEXT,
  criterion_11_program_topics_available_confidence NUMERIC(4,3),
  criterion_12_exact_interest_topic_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_12_exact_interest_topic_terms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  criterion_12_exact_interest_topic_labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  criterion_12_exact_interest_topic_confidence NUMERIC(4,3),
  criterion_13_interest_level2_category_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_13_interest_level2_category_values TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  criterion_13_interest_level2_category_labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  criterion_13_interest_level2_category_confidence NUMERIC(4,3),
  criterion_14_interest_level1_section_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_14_interest_level1_section_direction TEXT,
  criterion_14_interest_level1_section_direction_label TEXT,
  criterion_14_interest_level1_section_confidence NUMERIC(4,3),
  criterion_15_fallback_text_keywords_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_15_fallback_text_keywords_value TEXT,
  criterion_15_fallback_text_keywords_confidence NUMERIC(4,3),
  criterion_16_interest_without_thematic_match_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_16_interest_without_thematic_match_interests TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  criterion_16_interest_without_thematic_match_specific_terms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  criterion_16_interest_without_thematic_match_interests_text TEXT,
  criterion_16_interest_without_thematic_match_direction TEXT,
  criterion_16_interest_without_thematic_match_confidence NUMERIC(4,3),
  criterion_17_completed_exact_topic_match_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_17_completed_exact_topic_match_value TEXT,
  criterion_17_completed_exact_topic_match_confidence NUMERIC(4,3),
  criterion_18_new_topic_same_level2_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_18_new_topic_same_level2_value TEXT,
  criterion_18_new_topic_same_level2_confidence NUMERIC(4,3),
  criterion_19_new_topic_same_level1_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_19_new_topic_same_level1_value TEXT,
  criterion_19_new_topic_same_level1_confidence NUMERIC(4,3),
  criterion_20_no_completed_topic_link_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_20_no_completed_topic_link_value TEXT,
  criterion_20_no_completed_topic_link_confidence NUMERIC(4,3),
  criterion_21_depth_signal_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_21_depth_signal_value TEXT,
  criterion_21_depth_signal_confidence NUMERIC(4,3),
  criterion_22_no_depth_signal_repeat_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_22_no_depth_signal_repeat_value TEXT,
  criterion_22_no_depth_signal_repeat_confidence NUMERIC(4,3),
  criterion_23_repeat_completed_level2_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_23_repeat_completed_level2_value TEXT,
  criterion_23_repeat_completed_level2_confidence NUMERIC(4,3),
  criterion_24_new_level2_new_level1_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_24_new_level2_new_level1_value TEXT,
  criterion_24_new_level2_new_level1_confidence NUMERIC(4,3),
  criterion_25_new_level2_same_level1_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_25_new_level2_same_level1_value TEXT,
  criterion_25_new_level2_same_level1_confidence NUMERIC(4,3),
  criterion_26_any_classifier_topic_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_26_any_classifier_topic_value TEXT,
  criterion_26_any_classifier_topic_confidence NUMERIC(4,3),
  criterion_27_new_interest_program_level_status TEXT NOT NULL DEFAULT 'not_specified',
  criterion_27_new_interest_program_level_value TEXT,
  criterion_27_new_interest_program_level_confidence NUMERIC(4,3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scenario1_criteria_recognition_method_check
    CHECK (recognition_method IN ('LLM', 'regexp')),
  CONSTRAINT scenario1_criteria_recognition_confidence_check
    CHECK (recognition_confidence >= 0 AND recognition_confidence <= 1)
);

ALTER TABLE scenario1_criteria_recognition_log
  ADD COLUMN IF NOT EXISTS criterion_01_municipality_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_01_municipality_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_01_municipality_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_02_organization_restriction_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_02_organization_restriction_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_02_organization_restriction_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_03_age_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_03_age_bucket TEXT,
  ADD COLUMN IF NOT EXISTS criterion_03_age_years INTEGER,
  ADD COLUMN IF NOT EXISTS criterion_03_age_text TEXT,
  ADD COLUMN IF NOT EXISTS criterion_03_age_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_04_cost_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_04_cost_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_04_cost_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_05_completed_program_exclusion_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_05_completed_program_exclusion_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_05_completed_program_exclusion_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_06_education_form_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_06_education_form_format TEXT,
  ADD COLUMN IF NOT EXISTS criterion_06_education_form_format_label TEXT,
  ADD COLUMN IF NOT EXISTS criterion_06_education_form_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_07_schedule_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_07_schedule_text TEXT,
  ADD COLUMN IF NOT EXISTS criterion_07_schedule_values TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS criterion_07_schedule_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_08_availability_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_08_availability_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_08_availability_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_09_direction_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_09_direction_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_09_direction_label TEXT,
  ADD COLUMN IF NOT EXISTS criterion_09_direction_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_10_group_size_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_10_group_size_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_10_group_size_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_11_program_topics_available_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_11_program_topics_available_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_11_program_topics_available_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_12_exact_interest_topic_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_12_exact_interest_topic_terms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS criterion_12_exact_interest_topic_labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS criterion_12_exact_interest_topic_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_13_interest_level2_category_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_13_interest_level2_category_values TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS criterion_13_interest_level2_category_labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS criterion_13_interest_level2_category_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_14_interest_level1_section_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_14_interest_level1_section_direction TEXT,
  ADD COLUMN IF NOT EXISTS criterion_14_interest_level1_section_direction_label TEXT,
  ADD COLUMN IF NOT EXISTS criterion_14_interest_level1_section_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_15_fallback_text_keywords_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_15_fallback_text_keywords_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_15_fallback_text_keywords_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_16_interest_without_thematic_match_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_16_interest_without_thematic_match_interests TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS criterion_16_interest_without_thematic_match_specific_terms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS criterion_16_interest_without_thematic_match_interests_text TEXT,
  ADD COLUMN IF NOT EXISTS criterion_16_interest_without_thematic_match_direction TEXT,
  ADD COLUMN IF NOT EXISTS criterion_16_interest_without_thematic_match_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_17_completed_exact_topic_match_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_17_completed_exact_topic_match_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_17_completed_exact_topic_match_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_18_new_topic_same_level2_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_18_new_topic_same_level2_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_18_new_topic_same_level2_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_19_new_topic_same_level1_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_19_new_topic_same_level1_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_19_new_topic_same_level1_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_20_no_completed_topic_link_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_20_no_completed_topic_link_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_20_no_completed_topic_link_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_21_depth_signal_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_21_depth_signal_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_21_depth_signal_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_22_no_depth_signal_repeat_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_22_no_depth_signal_repeat_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_22_no_depth_signal_repeat_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_23_repeat_completed_level2_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_23_repeat_completed_level2_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_23_repeat_completed_level2_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_24_new_level2_new_level1_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_24_new_level2_new_level1_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_24_new_level2_new_level1_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_25_new_level2_same_level1_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_25_new_level2_same_level1_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_25_new_level2_same_level1_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_26_any_classifier_topic_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_26_any_classifier_topic_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_26_any_classifier_topic_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS criterion_27_new_interest_program_level_status TEXT NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS criterion_27_new_interest_program_level_value TEXT,
  ADD COLUMN IF NOT EXISTS criterion_27_new_interest_program_level_confidence NUMERIC(4,3);

ALTER TABLE scenario1_criteria_recognition_log
  DROP COLUMN IF EXISTS criterion_01_municipality,
  DROP COLUMN IF EXISTS criterion_02_organization_restriction,
  DROP COLUMN IF EXISTS criterion_03_age,
  DROP COLUMN IF EXISTS criterion_04_cost,
  DROP COLUMN IF EXISTS criterion_05_completed_program_exclusion,
  DROP COLUMN IF EXISTS criterion_06_education_form,
  DROP COLUMN IF EXISTS criterion_07_schedule,
  DROP COLUMN IF EXISTS criterion_08_availability,
  DROP COLUMN IF EXISTS criterion_09_direction,
  DROP COLUMN IF EXISTS criterion_10_group_size,
  DROP COLUMN IF EXISTS criterion_11_program_topics_available,
  DROP COLUMN IF EXISTS criterion_12_exact_interest_topic,
  DROP COLUMN IF EXISTS criterion_13_interest_level2_category,
  DROP COLUMN IF EXISTS criterion_14_interest_level1_section,
  DROP COLUMN IF EXISTS criterion_15_fallback_text_keywords,
  DROP COLUMN IF EXISTS criterion_16_interest_without_thematic_match,
  DROP COLUMN IF EXISTS criterion_17_completed_exact_topic_match,
  DROP COLUMN IF EXISTS criterion_18_new_topic_same_level2,
  DROP COLUMN IF EXISTS criterion_19_new_topic_same_level1,
  DROP COLUMN IF EXISTS criterion_20_no_completed_topic_link,
  DROP COLUMN IF EXISTS criterion_21_depth_signal,
  DROP COLUMN IF EXISTS criterion_22_no_depth_signal_repeat,
  DROP COLUMN IF EXISTS criterion_23_repeat_completed_level2,
  DROP COLUMN IF EXISTS criterion_24_new_level2_new_level1,
  DROP COLUMN IF EXISTS criterion_25_new_level2_same_level1,
  DROP COLUMN IF EXISTS criterion_26_any_classifier_topic,
  DROP COLUMN IF EXISTS criterion_27_new_interest_program_level;

CREATE INDEX IF NOT EXISTS scenario1_criteria_recognition_session_idx
  ON scenario1_criteria_recognition_log (platform, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS scenario1_criteria_recognition_channel_idx
  ON scenario1_criteria_recognition_log (channel, created_at DESC);
