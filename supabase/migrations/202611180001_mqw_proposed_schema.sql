-- MQW production-backend PREPARATION, not the application's active runtime.
-- The running application currently uses SQLite. No Supabase adapter is shipped
-- by this migration, and no project or provider is provisioned by this file.
-- Review and execute in an isolated Supabase project before any production use.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  slug text not null unique,
  title text not null,
  ordinal integer not null check (ordinal > 0),
  is_published boolean not null default false
);
create table public.lesson_versions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id),
  content_version text not null,
  schema_version integer not null check (schema_version > 0),
  content_hash text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (lesson_id, content_version)
);
create table public.lesson_steps (
  id uuid primary key default gen_random_uuid(),
  lesson_version_id uuid not null references public.lesson_versions(id),
  stable_step_id text not null,
  ordinal integer not null check (ordinal >= 0),
  kind text not null check (kind in ('explainer','confidence','single_choice',
    'multiple_choice','order','match','short_answer_self_check','feedback',
    'review_creation','reflection')),
  -- Public presentation ONLY. Never put correct answers, grading rules or
  -- answer-bearing feedback into the published presentation JSON.
  presentation jsonb not null default '{}'::jsonb,
  unique (lesson_version_id, stable_step_id),
  unique (lesson_version_id, ordinal)
);
create table private.lesson_answer_keys (
  lesson_version_id uuid not null references public.lesson_versions(id),
  stable_question_id text not null,
  grading_rules jsonb not null,
  feedback jsonb not null,
  primary key (lesson_version_id, stable_question_id)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  locale text not null default 'ar',
  timezone text not null default 'Asia/Hebron',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  study_minutes integer not null default 60 check (study_minutes between 1 and 1440),
  personalization boolean not null default false,
  reduced_motion boolean not null default false,
  habit_reminder boolean not null default false,
  deadline_notifications boolean not null default false,
  onboarding_done boolean not null default false,
  ai_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null,
  parent_id uuid,
  title text not null,
  ordinal integer not null default 0,
  unique (user_id, id),
  foreign key (user_id, subject_id) references public.subjects(user_id, id) on delete cascade,
  foreign key (user_id, parent_id) references public.topics(user_id, id),
  check (parent_id is null or parent_id <> id)
);
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid,
  topic_id uuid,
  subject_label text not null default '',
  planned_minutes integer not null default 60 check (planned_minutes between 1 and 1440),
  status text not null check (status in ('running','paused','completed')),
  started_at timestamptz not null,
  resumed_at timestamptz,
  elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, subject_id) references public.subjects(user_id, id),
  foreign key (user_id, topic_id) references public.topics(user_id, id)
);

create table public.lesson_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_version_id uuid not null references public.lesson_versions(id),
  previous_attempt_id uuid,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  current_step integer not null default 0 check (current_step >= 0),
  predicted_score numeric check (predicted_score between 0 and 100),
  predicted_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, id),
  foreign key (user_id, previous_attempt_id) references public.lesson_attempts(user_id, id)
);
create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null,
  stable_question_id text not null,
  submission_id uuid not null,
  response jsonb not null,
  retrieval_mode text not null check (retrieval_mode in ('free_recall','choice','recognition','order','match')),
  assistance text not null default 'none' check (assistance in ('none','revealed','hinted','retry_after_feedback')),
  submitted_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, submission_id),
  foreign key (user_id, attempt_id) references public.lesson_attempts(user_id, id) on delete cascade
);
create table public.assessment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_attempt_id uuid not null,
  grading_source text not null check (grading_source in ('deterministic','self_report','ungraded')),
  correct boolean,
  rating text check (rating in ('again','hard','good')),
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, question_attempt_id) references public.question_attempts(user_id, id) on delete cascade,
  check (grading_source <> 'ungraded' or correct is null)
);

create table public.memory_palaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  route_version integer not null default 1 check (route_version > 0),
  created_at timestamptz not null default now(),
  unique (user_id, id)
);
create table public.palace_loci (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  palace_id uuid not null,
  stable_locus_id text not null,
  ordinal integer not null check (ordinal between 1 and 5),
  name text not null,
  coordinates jsonb not null,
  unique (user_id, id),
  unique (palace_id, ordinal),
  foreign key (user_id, palace_id) references public.memory_palaces(user_id, id) on delete cascade
);
create table public.palace_association_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  locus_id uuid not null,
  version integer not null check (version > 0),
  fact text not null,
  mnemonic_image text not null,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  unique (locus_id, version),
  foreign key (user_id, locus_id) references public.palace_loci(user_id, id) on delete cascade
);
create table public.palace_trials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  palace_id uuid not null,
  route_version integer not null,
  kind text not null check (kind in ('concept','route')),
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, id),
  foreign key (user_id, palace_id) references public.memory_palaces(user_id, id) on delete cascade
);
create table private.palace_trial_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  trial_id uuid not null,
  locus_id uuid not null,
  association_version_id uuid not null,
  fact text not null,
  mnemonic_image text not null,
  primary key (user_id, trial_id, locus_id),
  foreign key (user_id, trial_id) references public.palace_trials(user_id, id) on delete cascade,
  foreign key (user_id, locus_id) references public.palace_loci(user_id, id),
  foreign key (user_id, association_version_id) references public.palace_association_versions(user_id, id)
);
create table public.palace_trial_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trial_id uuid not null,
  locus_id uuid not null,
  response text,
  skipped boolean not null default false,
  rating text check (rating in ('again','hard','good')),
  revealed_at timestamptz,
  submitted_at timestamptz not null default now(),
  unique (user_id, id),
  unique (trial_id, locus_id),
  foreign key (user_id, trial_id) references public.palace_trials(user_id, id) on delete cascade,
  foreign key (user_id, locus_id) references public.palace_loci(user_id, id),
  check (not skipped or rating is null)
);

create table public.review_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target text not null check (target in ('question','palace')),
  source_question_attempt_id uuid,
  source_palace_trial_id uuid,
  prompt text not null,
  due_at timestamptz not null,
  stage integer not null default 0 check (stage >= 0),
  algorithm text not null default 'fixed-v1',
  scheduler_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, source_question_attempt_id) references public.question_attempts(user_id, id) on delete cascade,
  foreign key (user_id, source_palace_trial_id) references public.palace_trials(user_id, id) on delete cascade,
  check ((target = 'question' and source_question_attempt_id is not null and source_palace_trial_id is null)
      or (target = 'palace' and source_palace_trial_id is not null and source_question_attempt_id is null))
);
create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null,
  submission_id uuid not null,
  response text,
  rating text check (rating in ('again','hard','good')),
  grading_source text not null check (grading_source in ('deterministic','self_report','ungraded')),
  correct boolean,
  algorithm text not null,
  previous_due_at timestamptz not null,
  next_due_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, submission_id),
  foreign key (user_id, card_id) references public.review_cards(user_id, id) on delete cascade
);
create table public.review_schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null,
  previous_due_at timestamptz not null,
  next_due_at timestamptz not null,
  reason text not null,
  timezone text not null,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, card_id) references public.review_cards(user_id, id) on delete cascade
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create table public.project_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  title text not null,
  ordinal integer not null check (ordinal >= 0),
  unique (user_id, id),
  foreign key (user_id, project_id) references public.projects(user_id, id) on delete cascade
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid,
  stage_id uuid,
  note_id uuid,
  title text not null,
  importance integer not null default 2 check (importance between 1 and 3),
  done boolean not null default false,
  priority boolean not null default false,
  due_date date,
  due_timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, project_id) references public.projects(user_id, id),
  foreign key (user_id, stage_id) references public.project_stages(user_id, id),
  foreign key (user_id, note_id) references public.notes(user_id, id)
);
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_description text,
  progress numeric not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create table public.goal_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  task_id uuid,
  project_id uuid,
  unique (user_id, id),
  foreign key (user_id, goal_id) references public.goals(user_id, id) on delete cascade,
  foreign key (user_id, task_id) references public.tasks(user_id, id) on delete cascade,
  foreign key (user_id, project_id) references public.projects(user_id, id) on delete cascade,
  check ((task_id is not null)::integer + (project_id is not null)::integer = 1)
);
create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  unique (user_id, id),
  foreign key (user_id, task_id) references public.tasks(user_id, id) on delete cascade,
  check (ends_at > starts_at)
);
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null,
  local_date date not null,
  timezone text not null,
  state text not null check (state in ('done','rest','skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (habit_id, local_date),
  foreign key (user_id, habit_id) references public.habits(user_id, id) on delete cascade
);
create table public.voice_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  object_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  duration_seconds numeric check (duration_seconds >= 0),
  status text not null check (status in ('pending','ready','failed')),
  created_at timestamptz not null default now(),
  unique (user_id, id),
  check (split_part(object_path, '/', 1) = user_id::text)
);
create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  win text not null default '',
  obstacle text not null default '',
  experiment text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, id)
);
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id text not null,
  rule_version integer not null,
  evidence_class text not null check (evidence_class in ('stated_preference','observed','hypothesis','unknown')),
  window_start timestamptz not null,
  window_end timestamptz not null,
  numerator integer check (numerator >= 0),
  denominator integer check (denominator >= 0),
  summary jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  check (window_end >= window_start),
  check (numerator is null or denominator is null or numerator <= denominator)
);
create table public.insight_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_id uuid not null,
  question_attempt_id uuid,
  review_event_id uuid,
  palace_trial_id uuid,
  study_session_id uuid,
  unique (user_id, id),
  foreign key (user_id, insight_id) references public.insights(user_id, id) on delete cascade,
  foreign key (user_id, question_attempt_id) references public.question_attempts(user_id, id) on delete cascade,
  foreign key (user_id, review_event_id) references public.review_events(user_id, id) on delete cascade,
  foreign key (user_id, palace_trial_id) references public.palace_trials(user_id, id) on delete cascade,
  foreign key (user_id, study_session_id) references public.study_sessions(user_id, id) on delete cascade,
  check ((question_attempt_id is not null)::integer + (review_event_id is not null)::integer
      + (palace_trial_id is not null)::integer + (study_session_id is not null)::integer = 1)
);
create table public.insight_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_id uuid,
  rule_id text not null,
  action text not null check (action in ('dismiss','inaccurate')),
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, insight_id) references public.insights(user_id, id) on delete cascade
);
create table public.data_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('export','delete')),
  status text not null check (status in ('requested','processing','completed','failed')),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, id)
);

-- All client-visible tables use RLS. No writes to shared educational definitions
-- or derived evidence are granted to authenticated clients. Future server RPCs
-- must validate the user, enforce durable submission, and grade server-side.
do $$
declare table_name text;
begin
  foreach table_name in array array['courses','lessons','lesson_versions','lesson_steps'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
  end loop;
  foreach table_name in array array['profiles','user_preferences','subjects','topics','study_sessions',
    'lesson_attempts','question_attempts','assessment_events','memory_palaces','palace_loci',
    'palace_association_versions','palace_trials','palace_trial_items','review_cards','review_events',
    'review_schedule_events','notes','journal_entries','projects','project_stages','tasks','goals',
    'goal_links','time_blocks','habits','habit_logs','voice_assets','weekly_reviews','insights',
    'insight_sources','insight_feedback','data_jobs'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name);
    execute format('create index on public.%I (user_id)', table_name);
  end loop;
  -- Only ordinary mutable user input is writable by an authenticated client.
  foreach table_name in array array['profiles','user_preferences','subjects','topics','study_sessions',
    'notes','journal_entries','projects','project_stages','tasks','goals','goal_links','time_blocks',
    'habits','habit_logs','weekly_reviews','insight_feedback'] loop
    execute format('grant insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name);
  end loop;
end $$;
create policy published_course on public.courses for select to authenticated using (is_published);
create policy published_lesson on public.lessons for select to authenticated using
  (is_published and exists (select 1 from public.courses c where c.id = course_id and c.is_published));
create policy published_version on public.lesson_versions for select to authenticated using
  (is_published and exists (select 1 from public.lessons l where l.id = lesson_id and l.is_published));
create policy published_step on public.lesson_steps for select to authenticated using
  (exists (select 1 from public.lesson_versions v where v.id = lesson_version_id and v.is_published));

alter table private.lesson_answer_keys enable row level security;
alter table private.palace_trial_snapshots enable row level security;
revoke all on all tables in schema private from public, anon, authenticated;
alter default privileges in schema private revoke all on tables from public, anon, authenticated;

-- Storage policies authorize requests by session identity. Do not create signed
-- bearer URLs for playback if strict cross-account URL isolation is required.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mqw-voice','mqw-voice',false,26214400,array['audio/webm','audio/mp4','audio/ogg','audio/wav','audio/mpeg'])
on conflict (id) do update set public = false;
create policy mqw_voice_read on storage.objects for select to authenticated using
  (bucket_id = 'mqw-voice' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy mqw_voice_create on storage.objects for insert to authenticated with check
  (bucket_id = 'mqw-voice' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy mqw_voice_remove on storage.objects for delete to authenticated using
  (bucket_id = 'mqw-voice' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
