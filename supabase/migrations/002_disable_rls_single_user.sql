-- Single-user mode: disable RLS and remove auth.users FK constraints.
-- Re-enable when multi-user auth is added.

-- 1. Disable RLS on all tables
ALTER TABLE cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE review_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_card_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;

-- 2. Drop FK constraints to auth.users so inserts work without auth
ALTER TABLE study_sessions DROP CONSTRAINT IF EXISTS study_sessions_user_id_fkey;
ALTER TABLE user_progress DROP CONSTRAINT IF EXISTS user_progress_user_id_fkey;
ALTER TABLE review_log DROP CONSTRAINT IF EXISTS review_log_user_id_fkey;
ALTER TABLE exam_results DROP CONSTRAINT IF EXISTS exam_results_user_id_fkey;
ALTER TABLE user_card_notes DROP CONSTRAINT IF EXISTS user_card_notes_user_id_fkey;
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_pkey;
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;

-- 3. Set a default UUID for user_id so client code doesn't need to provide it
-- Using a fixed "anonymous" UUID: 00000000-0000-0000-0000-000000000000
ALTER TABLE study_sessions ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE user_progress ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE review_log ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE exam_results ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE user_card_notes ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE user_settings ALTER COLUMN user_id SET DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE user_settings ADD PRIMARY KEY (user_id);
