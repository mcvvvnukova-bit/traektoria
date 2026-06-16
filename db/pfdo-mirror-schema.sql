CREATE TABLE IF NOT EXISTS pfdo_regions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  external BOOLEAN,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pfdo_operator_info (
  operator_id INTEGER PRIMARY KEY,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TABLE IF EXISTS pfdo_faq_questions;
DROP TABLE IF EXISTS pfdo_faq_categories;
DROP TABLE IF EXISTS pfdo_public_municipalities;

DO $$
BEGIN
  IF to_regclass('public.pfdo_raw_documents') IS NOT NULL THEN
    DELETE FROM pfdo_raw_documents
    WHERE document_key = 'public/municipalities'
       OR endpoint = '/public/municipalities';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pfdo_main_municipalities (
  id INTEGER PRIMARY KEY,
  operator_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  info_html TEXT,
  useful_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  useful_contacts_count INTEGER NOT NULL DEFAULT 0,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pfdo_main_municipalities
  ADD COLUMN IF NOT EXISTS info_html TEXT;

ALTER TABLE pfdo_main_municipalities
  ADD COLUMN IF NOT EXISTS useful_contacts JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE pfdo_main_municipalities
  ADD COLUMN IF NOT EXISTS useful_contacts_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF to_regclass('public.pfdo_municipality_info') IS NOT NULL THEN
    UPDATE pfdo_main_municipalities municipality
    SET
      info_html = COALESCE(info.info_html, municipality.info_html),
      useful_contacts = COALESCE(info.useful_contacts, municipality.useful_contacts),
      useful_contacts_count = COALESCE(info.useful_contacts_count, municipality.useful_contacts_count)
    FROM pfdo_municipality_info info
    WHERE info.municipality_id = municipality.id;
  END IF;

  IF to_regclass('public.pfdo_useful_contacts') IS NOT NULL THEN
    UPDATE pfdo_main_municipalities municipality
    SET
      useful_contacts = contact_agg.useful_contacts,
      useful_contacts_count = contact_agg.useful_contacts_count
    FROM (
      SELECT
        main_municipality.id AS municipality_id,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', contact.id,
              'operator_id', contact.operator_id,
              'mun_id', contact.mun_id,
              'name', contact.name,
              'phone', contact.phone,
              'email', contact.email,
              'created_by', contact.created_by,
              'raw_payload', contact.raw_payload
            )
            ORDER BY contact.id
          ) FILTER (WHERE contact.id IS NOT NULL),
          '[]'::jsonb
        ) AS useful_contacts,
        COUNT(contact.id)::INTEGER AS useful_contacts_count
      FROM pfdo_main_municipalities main_municipality
      LEFT JOIN pfdo_useful_contacts contact
        ON contact.mun_id = main_municipality.id
      GROUP BY main_municipality.id
    ) contact_agg
    WHERE contact_agg.municipality_id = municipality.id;
  END IF;
END $$;

DROP TABLE IF EXISTS pfdo_municipality_info;
DROP TABLE IF EXISTS pfdo_useful_contacts;

DO $$
BEGIN
  IF to_regclass('public.pfdo_program_directions') IS NULL THEN
    IF to_regclass('public.pfdo_progman_directions') IS NOT NULL THEN
      ALTER TABLE pfdo_progman_directions RENAME TO pfdo_program_directions;
    ELSIF to_regclass('public.pfdo_directions') IS NOT NULL THEN
      ALTER TABLE pfdo_directions RENAME TO pfdo_program_directions;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pfdo_program_directions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pfdo_addresses (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  lat TEXT,
  lng TEXT,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pfdo_organizational_forms (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

INSERT INTO pfdo_organizational_forms (id, name, description)
VALUES
  (1, 'Государственная/муниципальная организация', 'МБУ, МАУДО, школы, колледжи и другие государственные или муниципальные организации'),
  (2, 'ИП', 'индивидуальные предприниматели'),
  (3, 'Некоммерческая/частная образовательная организация', 'АНО, ЧОУ и другие некоммерческие или частные образовательные организации'),
  (4, 'Коммерческая организация', 'ООО и другие коммерческие юридические лица'),
  (17, 'Общественная организация', 'ВРОО и другие общественные организации или объединения')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS pfdo_program_kinds (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO pfdo_program_kinds (id, name)
VALUES
  (1, 'Дополнительная предпрофессиональная программа'),
  (2, 'Дополнительная общеразвивающая программа'),
  (3, 'Дополнительная образовательная программа спортивной подготовки')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS pfdo_program_education_forms (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO pfdo_program_education_forms (id, name)
VALUES
  (1, 'Очная'),
  (2, 'Очно-заочная'),
  (3, 'Заочная')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS pfdo_program_medical_certificate_requirements (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO pfdo_program_medical_certificate_requirements (id, name)
VALUES
  (0, 'Медицинская справка не требуется'),
  (1, 'Медицинская справка требуется')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS pfdo_program_levels (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

INSERT INTO pfdo_program_levels (id, name, description)
VALUES
  (1, 'Стартовый (ознакомительный).', 'Стартовый (ознакомительный)'),
  (2, 'Базовый', 'Базовый'),
  (3, 'Продвинутый (углубленный)', 'Продвинутый (углубленный)'),
  (4, 'Не применимо', 'Не указан'),
  (5, 'Разноуровневая (несколько уровней в зависимости от модуля)', 'разноуровневая (несколько уровней в зависимости от модуля)')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS pfdo_program_document_types (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO pfdo_program_document_types (id, name)
VALUES
  (1, 'Нет'),
  (2, 'Сертификат о прохождении курса'),
  (3, 'Удостоверение о повышении квалификации'),
  (4, 'Свидетельство о присвоении квалификации'),
  (5, 'Свидетельство об освоении дополнительных предпрофессиональных программ в области искусств'),
  (6, 'Свидетельство об освоении дополнительных предпрофессиональных программ в области спорта'),
  (7, 'Свидетельство об обучении'),
  (8, 'Диплом выпускника художественной школы'),
  (9, 'Диплом выпускника музыкальной школы'),
  (10, 'Диплом выпускника спортивной школы'),
  (11, 'Удостоверение об освоении программы')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS pfdo_organizations (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  organizational_form INTEGER,
  level_id INTEGER,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_organizations_organizational_form_fkey'
      AND conrelid = 'pfdo_organizations'::regclass
  ) THEN
    ALTER TABLE pfdo_organizations
      ADD CONSTRAINT pfdo_organizations_organizational_form_fkey
      FOREIGN KEY (organizational_form)
      REFERENCES pfdo_organizational_forms (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfdo_organizations_organizational_form_idx
  ON pfdo_organizations (organizational_form);

CREATE TABLE IF NOT EXISTS pfdo_programs (
  id BIGINT PRIMARY KEY,
  operator_id INTEGER NOT NULL,
  municipality_id INTEGER,
  search_name TEXT,
  full_name TEXT,
  short_name TEXT,
  kind INTEGER,
  direction_id INTEGER,
  edu_form INTEGER,
  duration_year INTEGER,
  duration_month INTEGER,
  age_group_min INTEGER,
  age_group_max INTEGER,
  need_medical_certificate INTEGER,
  modules_count INTEGER,
  directory_level_id INTEGER,
  directory_program_document_id INTEGER,
  video_link TEXT,
  annotation_html TEXT,
  task_html TEXT,
  duration_string TEXT,
  organization_id BIGINT,
  organization_name TEXT,
  address_name TEXT,
  all_region INTEGER,
  enrollment INTEGER,
  source_url TEXT,
  program_document_url TEXT,
  program_document_local_path TEXT,
  program_document_file_url TEXT,
  program_document_content_type TEXT,
  program_document_file_size BIGINT,
  program_document_downloaded_at TIMESTAMPTZ,
  program_document_download_error TEXT,
  search_payload JSONB,
  detail_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pfdo_programs
  DROP COLUMN IF EXISTS average_score;

ALTER TABLE pfdo_programs
  DROP COLUMN IF EXISTS distance;

ALTER TABLE pfdo_programs
  ADD COLUMN IF NOT EXISTS organization_id BIGINT;

UPDATE pfdo_programs
SET organization_id = (detail_payload -> 'organization' ->> 'id')::bigint
WHERE organization_id IS NULL
  AND detail_payload -> 'organization' ->> 'id' IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_programs_kind_fkey'
      AND conrelid = 'pfdo_programs'::regclass
  ) THEN
    ALTER TABLE pfdo_programs
      ADD CONSTRAINT pfdo_programs_kind_fkey
      FOREIGN KEY (kind)
      REFERENCES pfdo_program_kinds (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfdo_programs_kind_idx
  ON pfdo_programs (kind);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_programs_organization_id_fkey'
      AND conrelid = 'pfdo_programs'::regclass
  ) THEN
    ALTER TABLE pfdo_programs
      ADD CONSTRAINT pfdo_programs_organization_id_fkey
      FOREIGN KEY (organization_id)
      REFERENCES pfdo_organizations (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfdo_programs_organization_id_idx
  ON pfdo_programs (organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_programs_edu_form_fkey'
      AND conrelid = 'pfdo_programs'::regclass
  ) THEN
    ALTER TABLE pfdo_programs
      ADD CONSTRAINT pfdo_programs_edu_form_fkey
      FOREIGN KEY (edu_form)
      REFERENCES pfdo_program_education_forms (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfdo_programs_edu_form_idx
  ON pfdo_programs (edu_form);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_programs_need_medical_certificate_fkey'
      AND conrelid = 'pfdo_programs'::regclass
  ) THEN
    ALTER TABLE pfdo_programs
      ADD CONSTRAINT pfdo_programs_need_medical_certificate_fkey
      FOREIGN KEY (need_medical_certificate)
      REFERENCES pfdo_program_medical_certificate_requirements (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfdo_programs_need_medical_certificate_idx
  ON pfdo_programs (need_medical_certificate);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_programs_directory_level_id_fkey'
      AND conrelid = 'pfdo_programs'::regclass
  ) THEN
    ALTER TABLE pfdo_programs
      ADD CONSTRAINT pfdo_programs_directory_level_id_fkey
      FOREIGN KEY (directory_level_id)
      REFERENCES pfdo_program_levels (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfdo_programs_directory_level_idx
  ON pfdo_programs (directory_level_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_programs_directory_program_document_id_fkey'
      AND conrelid = 'pfdo_programs'::regclass
  ) THEN
    ALTER TABLE pfdo_programs
      ADD CONSTRAINT pfdo_programs_directory_program_document_id_fkey
      FOREIGN KEY (directory_program_document_id)
      REFERENCES pfdo_program_document_types (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfdo_programs_directory_program_document_idx
  ON pfdo_programs (directory_program_document_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_programs_direction_id_fkey'
      AND conrelid = 'pfdo_programs'::regclass
  ) THEN
    ALTER TABLE pfdo_programs
      ADD CONSTRAINT pfdo_programs_direction_id_fkey
      FOREIGN KEY (direction_id)
      REFERENCES pfdo_program_directions (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfdo_programs_direction_idx
  ON pfdo_programs (direction_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_programs_municipality_id_fkey'
      AND conrelid = 'pfdo_programs'::regclass
  ) THEN
    ALTER TABLE pfdo_programs
      ADD CONSTRAINT pfdo_programs_municipality_id_fkey
      FOREIGN KEY (municipality_id)
      REFERENCES pfdo_main_municipalities (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfdo_programs_municipality_idx
  ON pfdo_programs (municipality_id);

CREATE TABLE IF NOT EXISTS pfdo_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  run_type TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  counters JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_text TEXT
);

CREATE INDEX IF NOT EXISTS pfdo_sync_runs_status_idx
  ON pfdo_sync_runs (status, started_at DESC);

CREATE INDEX IF NOT EXISTS pfdo_sync_runs_type_idx
  ON pfdo_sync_runs (run_type, started_at DESC);

CREATE TABLE IF NOT EXISTS pfdo_program_sync_state (
  program_id BIGINT PRIMARY KEY,
  catalog_status TEXT NOT NULL DEFAULT 'active',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  last_catalog_missing_at TIMESTAMPTZ,
  last_detail_imported_at TIMESTAMPTZ,
  last_document_processed_at TIMESTAMPTZ,
  last_topics_processed_at TIMESTAMPTZ,
  search_payload_hash TEXT,
  detail_payload_hash TEXT,
  document_status TEXT NOT NULL DEFAULT 'pending',
  topics_status TEXT NOT NULL DEFAULT 'pending',
  last_sync_run_id BIGINT,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pfdo_program_sync_state_catalog_idx
  ON pfdo_program_sync_state (catalog_status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS pfdo_program_sync_state_processing_idx
  ON pfdo_program_sync_state (document_status, topics_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS pfdo_program_sync_state_run_idx
  ON pfdo_program_sync_state (last_sync_run_id);

CREATE TABLE IF NOT EXISTS pfdo_program_activity_links (
  program_id BIGINT NOT NULL,
  activity_id INTEGER NOT NULL,
  PRIMARY KEY (program_id, activity_id)
);

CREATE TABLE IF NOT EXISTS pfdo_program_project_links (
  program_id BIGINT NOT NULL,
  project_id INTEGER NOT NULL,
  PRIMARY KEY (program_id, project_id)
);

CREATE TABLE IF NOT EXISTS pfdo_program_activities (
  program_id BIGINT NOT NULL,
  activity_name TEXT NOT NULL,
  PRIMARY KEY (program_id, activity_name)
);

CREATE TABLE IF NOT EXISTS pfdo_program_keywords (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pfdo_program_keyword_links (
  program_id BIGINT NOT NULL,
  keyword_id INTEGER NOT NULL,
  PRIMARY KEY (program_id, keyword_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_program_keyword_links_program_id_fkey'
      AND conrelid = 'pfdo_program_keyword_links'::regclass
  ) THEN
    ALTER TABLE pfdo_program_keyword_links
      ADD CONSTRAINT pfdo_program_keyword_links_program_id_fkey
      FOREIGN KEY (program_id)
      REFERENCES pfdo_programs (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_program_keyword_links_keyword_id_fkey'
      AND conrelid = 'pfdo_program_keyword_links'::regclass
  ) THEN
    ALTER TABLE pfdo_program_keyword_links
      ADD CONSTRAINT pfdo_program_keyword_links_keyword_id_fkey
      FOREIGN KEY (keyword_id)
      REFERENCES pfdo_program_keywords (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfdo_program_keyword_links_keyword_idx
  ON pfdo_program_keyword_links (keyword_id);

CREATE TABLE IF NOT EXISTS pfdo_program_modules (
  id BIGINT PRIMARY KEY,
  program_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  month INTEGER,
  hours_group TEXT,
  hours_group_dop TEXT,
  min_child_group INTEGER,
  max_child_group INTEGER,
  teacher_level_id INTEGER,
  teacher_category_id INTEGER,
  teacher_skill_level_id INTEGER,
  normative_price TEXT,
  price TEXT,
  results_html TEXT,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pfdo_program_calendar_topics (
  id BIGSERIAL PRIMARY KEY,
  program_id BIGINT NOT NULL,
  topic_order INTEGER NOT NULL,
  section_title TEXT,
  topic_name TEXT NOT NULL,
  hours_theory NUMERIC,
  hours_practice NUMERIC,
  hours_total NUMERIC,
  activity_type TEXT,
  control_form TEXT,
  source_section TEXT,
  source_excerpt TEXT,
  document_path TEXT,
  document_format TEXT,
  extraction_method TEXT,
  confidence NUMERIC,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pfdo_program_calendar_topics_program_idx
  ON pfdo_program_calendar_topics (program_id, topic_order);

CREATE INDEX IF NOT EXISTS pfdo_program_calendar_topics_activity_type_idx
  ON pfdo_program_calendar_topics (activity_type);

CREATE TABLE IF NOT EXISTS pfdo_program_topic_normalizations (
  id BIGSERIAL PRIMARY KEY,
  topic_id BIGINT NOT NULL UNIQUE,
  program_id BIGINT NOT NULL,
  raw_topic_name TEXT NOT NULL,
  normalized_topic_name TEXT,
  normalized_topic_key TEXT,
  activity_type_normalized TEXT,
  record_type TEXT NOT NULL,
  noise_reason TEXT,
  normalization_method TEXT NOT NULL,
  normalization_version TEXT NOT NULL,
  normalization_confidence NUMERIC,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pfdo_program_topic_normalizations_program_idx
  ON pfdo_program_topic_normalizations (program_id, normalized_topic_key);

CREATE INDEX IF NOT EXISTS pfdo_program_topic_normalizations_record_type_idx
  ON pfdo_program_topic_normalizations (record_type);

CREATE TABLE IF NOT EXISTS pfdo_program_topic_aggregates (
  id BIGSERIAL PRIMARY KEY,
  program_id BIGINT NOT NULL,
  normalized_topic_name TEXT NOT NULL,
  normalized_topic_key TEXT NOT NULL,
  record_type TEXT NOT NULL,
  topic_rows INTEGER NOT NULL,
  source_topic_ids BIGINT[] NOT NULL,
  raw_topic_examples JSONB NOT NULL,
  activity_types JSONB NOT NULL,
  hours_theory NUMERIC,
  hours_practice NUMERIC,
  hours_control NUMERIC,
  hours_total NUMERIC,
  first_topic_order INTEGER,
  aggregation_method TEXT NOT NULL,
  aggregation_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, normalized_topic_key, record_type)
);

CREATE INDEX IF NOT EXISTS pfdo_program_topic_aggregates_program_idx
  ON pfdo_program_topic_aggregates (program_id, record_type);

CREATE INDEX IF NOT EXISTS pfdo_program_topic_aggregates_key_idx
  ON pfdo_program_topic_aggregates (normalized_topic_key);

CREATE TABLE IF NOT EXISTS pfdo_program_topic_classifications (
  id BIGSERIAL PRIMARY KEY,
  aggregate_id BIGINT NOT NULL UNIQUE,
  program_id BIGINT NOT NULL,
  record_type TEXT NOT NULL,
  parent_code TEXT,
  parent_name TEXT,
  category_code TEXT NOT NULL,
  category_name TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  top_categories JSONB NOT NULL,
  matched_rules JSONB NOT NULL,
  input_text TEXT NOT NULL,
  classifier_method TEXT NOT NULL,
  classifier_version TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'auto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pfdo_program_topic_classifications_category_idx
  ON pfdo_program_topic_classifications (record_type, category_code);

CREATE INDEX IF NOT EXISTS pfdo_program_topic_classifications_program_idx
  ON pfdo_program_topic_classifications (program_id);

CREATE TABLE IF NOT EXISTS pfdo_program_topic_review_queue (
  id BIGSERIAL PRIMARY KEY,
  classification_id BIGINT NOT NULL UNIQUE,
  aggregate_id BIGINT NOT NULL,
  program_id BIGINT NOT NULL,
  raw_topic_examples JSONB NOT NULL,
  normalized_topic_name TEXT NOT NULL,
  predicted_record_type TEXT NOT NULL,
  predicted_category_code TEXT NOT NULL,
  predicted_category_name TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  manual_record_type TEXT,
  manual_category_code TEXT,
  manual_category_name TEXT,
  reviewer_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pfdo_program_topic_review_queue
  ADD COLUMN IF NOT EXISTS reviewer_note TEXT;

CREATE INDEX IF NOT EXISTS pfdo_program_topic_review_queue_status_idx
  ON pfdo_program_topic_review_queue (review_status, confidence);

CREATE TABLE IF NOT EXISTS pfdo_topic_classifier_golden_labels (
  id BIGSERIAL PRIMARY KEY,
  normalized_topic_name TEXT NOT NULL,
  context_text TEXT,
  record_type TEXT NOT NULL,
  category_code TEXT NOT NULL,
  category_name TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pfdo_topic_classifier_golden_labels_category_idx
  ON pfdo_topic_classifier_golden_labels (record_type, category_code);

CREATE TABLE IF NOT EXISTS pfdo_program_registry_entries (
  program_id BIGINT NOT NULL,
  registry_value INTEGER NOT NULL,
  name TEXT,
  status INTEGER,
  tooltip TEXT,
  button_name TEXT,
  button_active INTEGER,
  button_tooltip TEXT,
  reasons JSONB,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (program_id, registry_value)
);

CREATE TABLE IF NOT EXISTS pfdo_program_groups (
  id BIGINT PRIMARY KEY,
  program_id BIGINT NOT NULL,
  organization_id BIGINT,
  module_id BIGINT,
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  status INTEGER,
  free_places_counter INTEGER,
  typical_lesson_duration_minutes INTEGER,
  module_name TEXT,
  recommended_min_age_for_enrollment INTEGER,
  recommended_max_age_for_enrollment INTEGER,
  extra_places INTEGER,
  period_price TEXT,
  main_pedagogue_id BIGINT,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_program_groups_program_id_fkey'
      AND conrelid = 'pfdo_program_groups'::regclass
  ) THEN
    ALTER TABLE pfdo_program_groups
      ADD CONSTRAINT pfdo_program_groups_program_id_fkey
      FOREIGN KEY (program_id)
      REFERENCES pfdo_programs (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfdo_program_groups_program_idx
  ON pfdo_program_groups (program_id);

CREATE TABLE IF NOT EXISTS pfdo_group_addresses (
  group_id BIGINT NOT NULL,
  address_id BIGINT NOT NULL,
  office_id BIGINT,
  office_name TEXT,
  PRIMARY KEY (group_id, address_id, office_id)
);

DO $$
BEGIN
  IF to_regclass('public.pfdo_group_periods') IS NOT NULL
     AND to_regclass('public.pfdo_program_group_periods') IS NULL THEN
    ALTER TABLE pfdo_group_periods RENAME TO pfdo_program_group_periods;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pfdo_program_group_periods (
  group_id BIGINT NOT NULL,
  period_hash BIGINT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, period_hash)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_group_periods_pkey'
      AND conrelid = 'pfdo_program_group_periods'::regclass
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_program_group_periods_pkey'
      AND conrelid = 'pfdo_program_group_periods'::regclass
  ) THEN
    ALTER TABLE pfdo_program_group_periods
      RENAME CONSTRAINT pfdo_group_periods_pkey TO pfdo_program_group_periods_pkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_group_periods_group_id_fkey'
      AND conrelid = 'pfdo_program_group_periods'::regclass
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_program_group_periods_group_id_fkey'
      AND conrelid = 'pfdo_program_group_periods'::regclass
  ) THEN
    ALTER TABLE pfdo_program_group_periods
      RENAME CONSTRAINT pfdo_group_periods_group_id_fkey TO pfdo_program_group_periods_group_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pfdo_program_group_periods_group_id_fkey'
      AND conrelid = 'pfdo_program_group_periods'::regclass
  ) THEN
    ALTER TABLE pfdo_program_group_periods
      ADD CONSTRAINT pfdo_program_group_periods_group_id_fkey
      FOREIGN KEY (group_id)
      REFERENCES pfdo_program_groups (id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.pfdo_group_periods_group_idx') IS NOT NULL
     AND to_regclass('public.pfdo_program_group_periods_group_idx') IS NULL THEN
    ALTER INDEX pfdo_group_periods_group_idx RENAME TO pfdo_program_group_periods_group_idx;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pfdo_program_group_periods_group_idx
  ON pfdo_program_group_periods (group_id);

CREATE TABLE IF NOT EXISTS pfdo_group_schedule_entries (
  id BIGINT PRIMARY KEY,
  group_id BIGINT NOT NULL,
  period_hash BIGINT NOT NULL,
  week_day TEXT,
  start_time TEXT,
  end_time TEXT,
  office_id BIGINT,
  office_name TEXT,
  office_address TEXT,
  hours_count TEXT,
  week_policy INTEGER,
  is_odd INTEGER,
  week_number INTEGER,
  group_type INTEGER,
  subject TEXT,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pfdo_pedagogues (
  id BIGINT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  middle_name TEXT,
  raw_payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pfdo_schedule_entry_pedagogues (
  schedule_entry_id BIGINT NOT NULL,
  pedagogue_id BIGINT NOT NULL,
  PRIMARY KEY (schedule_entry_id, pedagogue_id)
);

CREATE TABLE IF NOT EXISTS pfdo_raw_documents (
  document_key TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  payload JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
