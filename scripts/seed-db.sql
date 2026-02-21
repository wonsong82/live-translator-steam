CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key VARCHAR(255) NOT NULL,
  source_language VARCHAR(10) NOT NULL DEFAULT 'ko',
  target_language VARCHAR(10) NOT NULL DEFAULT 'en',
  mode VARCHAR(20) NOT NULL DEFAULT 'hybrid',
  asr_provider VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sentence_index INTEGER NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT,
  confidence REAL,
  timestamp_ms BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  key VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  asr_provider VARCHAR(50),
  asr_model VARCHAR(100),
  translation_nmt_provider VARCHAR(50),
  translation_llm_provider VARCHAR(50),
  rate_limit_rpm INTEGER DEFAULT 60,
  audio_minutes_monthly INTEGER DEFAULT 1000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key VARCHAR(255) NOT NULL REFERENCES api_keys(key),
  session_id UUID REFERENCES sessions(id),
  audio_seconds REAL NOT NULL DEFAULT 0,
  asr_provider VARCHAR(50) NOT NULL,
  translation_characters INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_session ON transcripts(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_api_key ON usage(api_key);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_api_key ON sessions(api_key);

INSERT INTO api_keys (key, name) VALUES
  ('dev-test-key', 'Development Test Key')
ON CONFLICT (key) DO NOTHING;
