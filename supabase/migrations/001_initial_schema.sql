-- PMR Flashcards: Initial Schema
-- 7 tables + materialized view + RLS policies

-- ============================================================
-- 1. cards
-- ============================================================
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anki_guid TEXT UNIQUE NOT NULL,
  topic TEXT NOT NULL,
  front_html TEXT NOT NULL,
  back_html TEXT,
  cloze_deletions JSONB NOT NULL DEFAULT '[]',
  cloze_count INT GENERATED ALWAYS AS (jsonb_array_length(cloze_deletions)) STORED,
  plain_text TEXT NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', plain_text)) STORED,
  tags TEXT[] DEFAULT '{}',
  user_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cards_search ON cards USING GIN (search_vector);
CREATE INDEX idx_cards_topic ON cards (topic);
CREATE INDEX idx_cards_tags ON cards USING GIN (tags);

-- ============================================================
-- 2. study_sessions (referenced by review_log and exam_results)
-- ============================================================
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('review', 'exam', 'drill', 'browse')),
  topic_filter TEXT[],
  cards_reviewed INT DEFAULT 0,
  cards_correct INT DEFAULT 0,
  duration_seconds INT,
  session_state JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- ============================================================
-- 3. user_progress
-- ============================================================
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  card_id UUID REFERENCES cards(id) NOT NULL,
  cloze_index INT NOT NULL DEFAULT 1,
  due TIMESTAMPTZ,
  stability REAL NOT NULL DEFAULT 0,
  difficulty REAL NOT NULL DEFAULT 0,
  reps INT NOT NULL DEFAULT 0,
  lapses INT NOT NULL DEFAULT 0,
  card_state SMALLINT NOT NULL DEFAULT 0,
  elapsed_days INT NOT NULL DEFAULT 0,
  scheduled_days INT NOT NULL DEFAULT 0,
  last_reviewed TIMESTAMPTZ,
  last_rating SMALLINT CHECK (last_rating BETWEEN 1 AND 4),
  review_count INT DEFAULT 0,
  streak INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, card_id, cloze_index)
);

CREATE INDEX idx_progress_due ON user_progress (user_id, due) WHERE due IS NOT NULL;
CREATE INDEX idx_progress_user ON user_progress (user_id);

-- ============================================================
-- 4. review_log
-- ============================================================
CREATE TABLE review_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  card_id UUID REFERENCES cards(id) NOT NULL,
  cloze_index INT NOT NULL DEFAULT 1,
  session_id UUID REFERENCES study_sessions(id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 4),
  is_correct BOOLEAN GENERATED ALWAYS AS (rating >= 3) STORED,
  response_time_ms INT,
  stability_before REAL,
  stability_after REAL,
  reviewed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_review_log_user_time ON review_log (user_id, reviewed_at DESC);
CREATE INDEX idx_review_log_analytics ON review_log (user_id, reviewed_at DESC)
  INCLUDE (card_id, is_correct);
CREATE INDEX idx_review_log_session ON review_log (session_id);

-- ============================================================
-- 5. exam_results
-- ============================================================
CREATE TABLE exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES study_sessions(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  total_questions INT NOT NULL,
  correct_count INT NOT NULL,
  score_by_topic JSONB NOT NULL,
  duration_seconds INT,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. user_card_notes
-- ============================================================
CREATE TABLE user_card_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  card_id UUID REFERENCES cards(id) NOT NULL,
  note TEXT,
  is_starred BOOLEAN DEFAULT false,
  is_flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, card_id)
);

-- ============================================================
-- 7. user_settings
-- ============================================================
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  daily_new_card_limit INT DEFAULT 20,
  daily_review_limit INT DEFAULT 200,
  default_session_size INT DEFAULT 50,
  fsrs_desired_retention REAL DEFAULT 0.9,
  timezone TEXT DEFAULT 'America/Chicago',
  day_start_hour INT DEFAULT 4,
  theme TEXT DEFAULT 'system',
  pomodoro_enabled BOOLEAN DEFAULT false,
  pomodoro_work_minutes INT DEFAULT 25,
  pomodoro_break_minutes INT DEFAULT 5,
  exam_time_multiplier REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Materialized view: topic accuracy (refresh via pg_cron)
-- ============================================================
CREATE MATERIALIZED VIEW mv_topic_accuracy AS
SELECT
  rl.user_id,
  c.topic,
  COUNT(*) FILTER (WHERE rl.is_correct) AS correct_count,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE rl.is_correct)::float / NULLIF(COUNT(*), 0) AS accuracy,
  MAX(rl.reviewed_at) AS latest_review
FROM review_log rl
JOIN cards c ON c.id = rl.card_id
WHERE rl.reviewed_at >= NOW() - INTERVAL '30 days'
GROUP BY rl.user_id, c.topic;

CREATE UNIQUE INDEX ON mv_topic_accuracy (user_id, topic);

-- pg_cron refresh (uncomment after enabling pg_cron extension in Supabase):
-- SELECT cron.schedule('refresh-topic-accuracy', '*/15 * * * *',
--   'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_topic_accuracy');

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_card_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Cards: read-only for authenticated users (writes via service role only)
CREATE POLICY "cards_select" ON cards
  FOR SELECT TO authenticated
  USING (true);

-- All user-owned tables: users can only access their own data
CREATE POLICY "sessions_all" ON study_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "progress_all" ON user_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "review_log_all" ON review_log
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exam_results_all" ON exam_results
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "card_notes_all" ON user_card_notes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settings_all" ON user_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
