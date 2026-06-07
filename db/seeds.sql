INSERT INTO bot_runtime_state (state_key, payload, updated_at)
VALUES (
  'telegram_update_offset',
  '{"updateOffset":0}'::jsonb,
  NOW()
)
ON CONFLICT (state_key) DO NOTHING;
